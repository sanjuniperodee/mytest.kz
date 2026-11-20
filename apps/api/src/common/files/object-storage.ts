/**
 * Файлы my-test в S3 (PS Cloud Object Storage, бакет общий с MyBooks, префикс S3_PREFIX — по умолчанию «mytest/»).
 * S3 — основное место, папки uploads/ и private-chat-media/ — копия на диске: запись идёт в оба места, а файл, которого
 * нет на диске (новый сервер, очищенная папка), скачивается из бакета при первом обращении. Без S3_* — только диск.
 */
import { createHash, createHmac } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Минимальный клиент S3 (подпись AWS SigV4, адресация path-style) — без SDK: хранилищу нужны пять операций.
 * Проверен на PS Cloud Object Storage (object.pscloud.io); подойдёт любой S3-совместимый сервис.
 */
export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Префикс ключей в бакете, например «mybooks/»: бакет может быть общим для нескольких проектов. */
  prefix: string;
};

export type S3Object = { key: string; size: number; modifiedMs: number };

const sha256 = (data: string | Buffer | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** Кодирование по правилам SigV4: всё, кроме unreserved-символов; «/» в пути объекта сохраняется. */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encPath = (s: string) => s.split("/").map(enc).join("/");

export class S3Error extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createS3(cfg: S3Config) {
  const base = new URL(cfg.endpoint);
  const objectPath = (key: string) => `/${enc(cfg.bucket)}/${encPath(cfg.prefix + key)}`;

  function sign(method: string, pathname: string, query: Record<string, string>, payloadHash: string, extra: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = amzDate.slice(0, 8);
    const headers: Record<string, string> = { host: base.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, ...extra };
    const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
    const qs = Object.keys(query)
      .sort()
      .map((k) => `${enc(k)}=${enc(query[k])}`)
      .join("&");
    const canonical = [method, pathname, qs, names.map((h) => `${h}:${lower[h]}\n`).join(""), names.join(";"), payloadHash].join("\n");
    const scope = `${day}/${cfg.region}/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
    const kDate = hmac(`AWS4${cfg.secretAccessKey}`, day);
    const kSigning = hmac(hmac(hmac(kDate, cfg.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
    delete headers.host;
    return { url: `${base.origin}${pathname}${qs ? `?${qs}` : ""}`, headers };
  }

  async function request(method: string, pathname: string, opts: { query?: Record<string, string>; body?: Buffer | Readable; payloadHash?: string; headers?: Record<string, string> } = {}) {
    const payloadHash = opts.payloadHash ?? sha256(Buffer.isBuffer(opts.body) ? opts.body : "");
    const { url, headers } = sign(method, pathname, opts.query ?? {}, payloadHash, opts.headers);
    const body = opts.body instanceof Readable ? (Readable.toWeb(opts.body) as ReadableStream) : opts.body;
    const res = await fetch(url, { method, headers, body, ...(opts.body instanceof Readable ? { duplex: "half" } : {}) } as RequestInit);
    return res;
  }

  async function fail(res: Response, what: string): Promise<never> {
    const text = await res.text().catch(() => "");
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? res.statusText;
    throw new S3Error(res.status, `S3 ${what}: ${res.status} ${code}`);
  }

  return {
    config: cfg,

    async put(key: string, data: Buffer | Uint8Array | string, contentType?: string) {
      const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const res = await request("PUT", objectPath(key), { body, headers: { "content-length": String(body.length), ...(contentType ? { "content-type": contentType } : {}) } });
      if (!res.ok) await fail(res, `put ${key}`);
    },

    /** Загрузить файл с диска потоком — без чтения целиком в память (видео до сотен МБ). */
    async putFile(key: string, file: string) {
      const { size } = await fs.stat(file);
      const res = await request("PUT", objectPath(key), { body: createReadStream(file), payloadHash: "UNSIGNED-PAYLOAD", headers: { "content-length": String(size) } });
      if (!res.ok) await fail(res, `put ${key}`);
    },

    /** Содержимое объекта; null — объекта нет. */
    async get(key: string): Promise<Buffer | null> {
      const res = await request("GET", objectPath(key));
      if (res.status === 404) return null;
      if (!res.ok) await fail(res, `get ${key}`);
      return Buffer.from(await res.arrayBuffer());
    },

    /** Скачать объект в файл (через временный рядом и rename). false — объекта нет. */
    async download(key: string, file: string): Promise<boolean> {
      const res = await request("GET", objectPath(key));
      if (res.status === 404) return false;
      if (!res.ok || !res.body) await fail(res, `get ${key}`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.dl-${process.pid}-${Math.random().toString(36).slice(2)}`;
      try {
        await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
        await fs.rename(tmp, file);
      } catch (err) {
        await fs.rm(tmp, { force: true }).catch(() => {});
        throw err;
      }
      return true;
    },

    async exists(key: string): Promise<boolean> {
      const res = await request("HEAD", objectPath(key));
      if (res.status === 404) return false;
      if (!res.ok) await fail(res, `head ${key}`);
      return true;
    },

    async delete(key: string) {
      const res = await request("DELETE", objectPath(key));
      if (!res.ok && res.status !== 404) await fail(res, `delete ${key}`);
    },

    /** Все объекты под префиксом (рекурсивно); ключи — без префикса проекта. */
    async list(prefix: string): Promise<S3Object[]> {
      const out: S3Object[] = [];
      let token: string | undefined;
      do {
        const query: Record<string, string> = { "list-type": "2", prefix: cfg.prefix + prefix, "max-keys": "1000", ...(token ? { "continuation-token": token } : {}) };
        const res = await request("GET", `/${enc(cfg.bucket)}`, { query });
        if (!res.ok) await fail(res, `list ${prefix}`);
        const xml = await res.text();
        for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = unxml(/<Key>([\s\S]*?)<\/Key>/.exec(m[1])?.[1] ?? "");
          out.push({ key: key.slice(cfg.prefix.length), size: Number(/<Size>(\d+)<\/Size>/.exec(m[1])?.[1] ?? 0), modifiedMs: Date.parse(/<LastModified>([^<]+)<\/LastModified>/.exec(m[1])?.[1] ?? "") || 0 });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || undefined : undefined;
      } while (token);
      return out;
    },
  };
}

const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export type S3Client = ReturnType<typeof createS3>;


let client: S3Client | null | undefined;
/** Клиент S3 по окружению; null — S3 не настроен (локальная разработка, тесты). */
export function objectStorage(): S3Client | null {
  if (client !== undefined) return client;
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  client =
    S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
      ? createS3({
          endpoint: process.env.S3_ENDPOINT || 'https://object.pscloud.io',
          region: process.env.S3_REGION || 'us-east-1',
          bucket: S3_BUCKET,
          accessKeyId: S3_ACCESS_KEY_ID,
          secretAccessKey: S3_SECRET_ACCESS_KEY,
          prefix: process.env.S3_PREFIX ?? 'mytest/',
        })
      : null;
  return client;
}

/**
 * Перенести в бакет файл, который multer только что записал на диск, и удалить его с диска. Сбой не роняет запрос:
 * файл остаётся на диске и отдаётся оттуда, а при первом чтении /uploads/ сам уедет в бакет.
 */
export async function moveToS3(key: string, file: string, log?: { warn(msg: string): void }) {
  const s3 = objectStorage();
  if (!s3) return;
  try {
    await s3.putFile(key, file);
    await fs.rm(file, { force: true });
  } catch (err) {
    log?.warn(`S3: не выложен ${key}: ${(err as Error).message}`);
  }
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
export const mimeOf = (name: string) => MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream';

/** Удалить копию в бакете (диск чистит вызывающий). */
export async function removeFromS3(key: string) {
  await objectStorage()?.delete(key).catch(() => {});
}
