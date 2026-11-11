import { randomBytes, randomUUID, scryptSync } from 'crypto';

/**
 * Stand-ins for the database and Redis that the auth specs share. They answer only what auth asks
 * for: there are no test sessions, subscriptions or other models on purpose, so if auth ever
 * reached for the user's data the call would throw.
 */

export type Row = Record<string, any>;

/** Same format the removed signup wrote: `<salt hex>:<scrypt key hex>`. */
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${key.toString('hex')}`;
}

function matches(row: Row, where: Row) {
  return Object.entries(where).every(([field, expected]) => {
    const value = row[field] ?? null;
    if (expected && typeof expected === 'object' && 'gt' in expected) return value > expected.gt;
    return value === expected;
  });
}

export function userRow(data: Row): Row {
  return {
    id: randomUUID(),
    telegramId: null,
    telegramUsername: null,
    telegramLinkedAt: null,
    googleId: null,
    email: null,
    emailVerified: false,
    passwordHash: null,
    phone: null,
    firstName: null,
    lastName: null,
    avatarUrl: null,
    preferredLanguage: 'ru',
    isAdmin: false,
    isChannelMember: true,
    ...data,
  };
}

export function fakeDatabase() {
  const users: Row[] = [];
  const sessions: Row[] = [];
  const pushSubscriptions: Row[] = [];

  const findUser = async ({ where }: { where: Row }) => {
    const row = users.find((user) => matches(user, where));
    return row ? { ...row } : null;
  };

  const prisma = {
    user: {
      findUnique: findUser,
      findFirst: findUser,
      create: async ({ data }: { data: Row }) => {
        const row = userRow(data);
        users.push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = users.find((user) => matches(user, where));
        if (!row) throw new Error('user to update not found');
        Object.assign(row, data);
        return { ...row };
      },
    },
    authSession: {
      create: async ({ data }: { data: Row }) => {
        const row = { revokedAt: null, lastUsedAt: null, ...data };
        sessions.push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = sessions.find((session) => matches(session, where));
        if (!row) throw new Error('session to update not found');
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = sessions.filter((session) => matches(session, where));
        hit.forEach((session) => Object.assign(session, data));
        return { count: hit.length };
      },
      findUnique: async ({ where, include }: { where: Row; include?: { user?: boolean } }) => {
        const row = sessions.find((session) => matches(session, where));
        if (!row) return null;
        return include?.user
          ? { ...row, user: { ...users.find((user) => user.id === row.userId) } }
          : { ...row };
      },
      findFirst: async ({ where }: { where: Row }) => {
        const row = sessions.find((session) => matches(session, where));
        return row ? { id: row.id } : null;
      },
    },
    pushSubscription: {
      deleteMany: async ({ where }: { where: Row }) => {
        const kept = pushSubscriptions.filter((subscription) => !matches(subscription, where));
        const count = pushSubscriptions.length - kept.length;
        pushSubscriptions.splice(0, pushSubscriptions.length, ...kept);
        return { count };
      },
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };

  return { prisma, users, sessions, pushSubscriptions };
}

/**
 * Redis with the commands auth uses, expiry included. Time only moves when a test calls
 * `advance`, so "10 minutes later" costs nothing.
 */
export function fakeRedis() {
  let now = 0;
  const entries = new Map<string, { value: string; expiresAt: number | null }>();
  const deleted: string[] = [];

  const live = (key: string) => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    /** Every key `del` was called with, in order. */
    deleted,
    /** Current contents, expired entries dropped. */
    snapshot: () => {
      const result = new Map<string, string>();
      for (const key of [...entries.keys()]) {
        const entry = live(key);
        if (entry) result.set(key, entry.value);
      }
      return result;
    },
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    get: async (key: string) => live(key)?.value ?? null,
    set: async (key: string, value: string, ...options: Array<string | number>) => {
      const nx = options.includes('NX');
      const ex = options.indexOf('EX');
      if (nx && live(key)) return null;
      entries.set(key, {
        value,
        expiresAt: ex >= 0 ? now + Number(options[ex + 1]) * 1000 : null,
      });
      return 'OK';
    },
    incr: async (key: string) => {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      entries.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    decr: async (key: string) => {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) - 1;
      entries.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    expire: async (key: string, seconds: number) => {
      const entry = live(key);
      if (!entry) return 0;
      entry.expiresAt = now + seconds * 1000;
      return 1;
    },
    del: async (...keys: string[]) => {
      deleted.push(...keys);
      return keys.filter((key) => live(key) && entries.delete(key)).length;
    },
  };
}
