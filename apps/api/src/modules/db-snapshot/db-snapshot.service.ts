import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import * as path from 'path';

type ParsedPostgresConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  sslMode?: string;
};

const DEFAULT_SNAPSHOT_HOUR = 6;
const DEFAULT_SNAPSHOT_MINUTE = 0;
const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_SNAPSHOT_DIR = path.join(process.cwd(), 'backups', 'db-snapshots');

@Injectable()
export class DbSnapshotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbSnapshotService.name);
  private timer: NodeJS.Timeout | null = null;
  private enabled = false;
  private snapshotDir = DEFAULT_SNAPSHOT_DIR;
  private retentionDays = DEFAULT_RETENTION_DAYS;
  private snapshotHour = DEFAULT_SNAPSHOT_HOUR;
  private snapshotMinute = DEFAULT_SNAPSHOT_MINUTE;
  private dbConfig: ParsedPostgresConfig | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const nodeEnv = String(this.config.get('NODE_ENV') ?? '').toLowerCase();
    const enabledRaw = this.config.get<string>('DB_SNAPSHOT_ENABLED');
    this.enabled =
      enabledRaw === undefined || enabledRaw === null || enabledRaw === ''
        ? nodeEnv === 'production'
        : this.parseBool(enabledRaw);

    if (!this.enabled) {
      this.logger.log('DB snapshot scheduler disabled');
      return;
    }

    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      this.logger.warn('DB snapshot scheduler disabled: DATABASE_URL is missing');
      return;
    }

    try {
      this.dbConfig = this.parseDatabaseUrl(databaseUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid DATABASE_URL';
      this.logger.error(`DB snapshot scheduler disabled: ${message}`);
      return;
    }

    this.snapshotDir = this.config.get<string>('DB_SNAPSHOT_DIR') || DEFAULT_SNAPSHOT_DIR;
    this.retentionDays = this.readIntFromConfig('DB_SNAPSHOT_RETENTION_DAYS', DEFAULT_RETENTION_DAYS, 1, 365);
    this.snapshotHour = this.readIntFromConfig('DB_SNAPSHOT_HOUR', DEFAULT_SNAPSHOT_HOUR, 0, 23);
    this.snapshotMinute = this.readIntFromConfig('DB_SNAPSHOT_MINUTE', DEFAULT_SNAPSHOT_MINUTE, 0, 59);

    await fs.mkdir(this.snapshotDir, { recursive: true });
    await this.pruneOldSnapshots();
    this.scheduleNextRun('init');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private parseBool(raw: string): boolean {
    const v = String(raw).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on', 'y'].includes(v);
  }

  private readIntFromConfig(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = this.config.get<string>(key);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    if (normalized < min) return min;
    if (normalized > max) return max;
    return normalized;
  }

  private parseDatabaseUrl(databaseUrl: string): ParsedPostgresConfig {
    const u = new URL(databaseUrl);
    if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') {
      throw new Error('DATABASE_URL must be postgres/postgresql');
    }
    const host = u.hostname;
    const port = Number(u.port || '5432');
    const username = decodeURIComponent(u.username || '');
    const password = decodeURIComponent(u.password || '');
    const database = decodeURIComponent((u.pathname || '').replace(/^\//, ''));
    const sslMode = u.searchParams.get('sslmode') || undefined;

    if (!host || !username || !database || !Number.isFinite(port)) {
      throw new Error('DATABASE_URL must contain host, username, database and valid port');
    }

    return { host, port, username, password, database, sslMode };
  }

  private scheduleNextRun(reason: string) {
    if (!this.dbConfig) return;
    if (this.timer) clearTimeout(this.timer);

    const now = new Date();
    const next = new Date(now);
    next.setHours(this.snapshotHour, this.snapshotMinute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const delayMs = next.getTime() - now.getTime();
    this.timer = setTimeout(() => {
      void this.handleScheduledRun();
    }, delayMs);
    this.timer.unref?.();

    this.logger.log(
      `DB snapshot scheduled (${reason}): next run at ${next.toISOString()} (retention ${this.retentionDays} day(s))`,
    );
  }

  private async handleScheduledRun() {
    try {
      await this.createSnapshot();
      await this.pruneOldSnapshots();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`DB snapshot run failed: ${message}`);
    } finally {
      this.scheduleNextRun('rerun');
    }
  }

  private async createSnapshot() {
    if (!this.dbConfig) return;
    const ts = this.formatFileTimestamp(new Date());
    const filename = `db-snapshot-${ts}.dump`;
    const fullPath = path.join(this.snapshotDir, filename);
    const args = [
      '-h',
      this.dbConfig.host,
      '-p',
      String(this.dbConfig.port),
      '-U',
      this.dbConfig.username,
      '-d',
      this.dbConfig.database,
      '-F',
      'c',
      '-f',
      fullPath,
    ];

    const env = {
      ...process.env,
      ...(this.dbConfig.password ? { PGPASSWORD: this.dbConfig.password } : {}),
      ...(this.dbConfig.sslMode ? { PGSSLMODE: this.dbConfig.sslMode } : {}),
    };

    const stderrChunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const child = spawn('pg_dump', args, { env });

      child.stderr.on('data', (chunk) => {
        stderrChunks.push(String(chunk));
      });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const stderr = stderrChunks.join('').trim();
          reject(new Error(stderr || `pg_dump exited with code ${code ?? 'unknown'}`));
        }
      });
    });

    const stat = await fs.stat(fullPath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    this.logger.log(`DB snapshot created: ${fullPath} (${sizeMb} MB)`);
  }

  private async pruneOldSnapshots() {
    const files = await fs.readdir(this.snapshotDir, { withFileTypes: true });
    const now = Date.now();
    const maxAgeMs = this.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.isFile()) continue;
      if (!file.name.startsWith('db-snapshot-') || !file.name.endsWith('.dump')) continue;

      const fullPath = path.join(this.snapshotDir, file.name);
      const stat = await fs.stat(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.unlink(fullPath);
        this.logger.log(`DB snapshot removed (retention): ${fullPath}`);
      }
    }
  }

  private formatFileTimestamp(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  }
}
