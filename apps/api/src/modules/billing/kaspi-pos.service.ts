import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';

/**
 * Клиент HTTP API [kaspi-pos-automation](https://github.com/tapter-dev/kaspi-pos-automation).
 * Контракт полей — docs/API.md репозитория (camelCase, success/processId на верхнем уровне auth).
 */
export interface KaspiAuth {
  tokenSN: string;
  vtokenSecret: string;
  profileId: number;
  organizationId: number;
}

export interface InvoiceResult {
  id: string | number;
  status: string;
  amount: number;
  clientMobile: string;
  receiptUrl: string;
  orderNumber: string;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

@Injectable()
export class KaspiPosService implements OnModuleInit {
  private readonly logger = new Logger(KaspiPosService.name);
  private auth: KaspiAuth | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    const tokenSN = this.config.get<string>('KASPI_TOKEN_SN')?.trim();
    const vtokenSecret = this.config.get<string>('KASPI_VTOKEN_SECRET')?.trim();
    const profileRaw = this.config.get<string>('KASPI_PROFILE_ID')?.trim();
    const orgRaw = this.config.get<string>('KASPI_ORGANIZATION_ID')?.trim();

    if (tokenSN && vtokenSecret) {
      this.auth = {
        tokenSN,
        vtokenSecret,
        profileId: profileRaw ? Number.parseInt(profileRaw, 10) : 0,
        organizationId: orgRaw ? Number.parseInt(orgRaw, 10) : 0,
      };
      return;
    }

    const fromRedis = await this.loadAuthFromRedis();
    if (fromRedis) {
      this.auth = fromRedis;
      this.logger.log('Kaspi POS session loaded from Redis');
    }
  }

  private redisKey(): string {
    return (
      this.config.get<string>('KASPI_SESSION_REDIS_KEY')?.trim() ||
      'bilimland:kaspi-pos:session'
    );
  }

  private async loadAuthFromRedis(): Promise<KaspiAuth | null> {
    try {
      const raw = await this.redis.get(this.redisKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<KaspiAuth>;
      if (!parsed.tokenSN || !parsed.vtokenSecret) return null;
      return {
        tokenSN: String(parsed.tokenSN),
        vtokenSecret: String(parsed.vtokenSecret),
        profileId: Number(parsed.profileId ?? 0),
        organizationId: Number(parsed.organizationId ?? 0),
      };
    } catch (e) {
      this.logger.warn(`Kaspi Redis load failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  private async persistAuth(): Promise<void> {
    if (!this.auth) {
      await this.redis.del(this.redisKey());
      return;
    }
    await this.redis.set(this.redisKey(), JSON.stringify(this.auth));
  }

  private baseUrl(): string {
    const u = this.config.get<string>('KASPI_API_URL') || 'http://localhost:3000';
    return u.replace(/\/+$/, '');
  }

  /** После OTP из ответа verify-otp (для ручной/админской привязки). */
  async setSessionAuth(auth: KaspiAuth) {
    this.auth = auth;
    await this.persistAuth();
  }

  getSessionAuth(): KaspiAuth | null {
    return this.auth;
  }

  async initAuth(phoneNumber: string): Promise<{ processId: string }> {
    const base = this.baseUrl();
    const initRes = await fetch(`${base}/api/auth/init`, { method: 'POST' });
    if (!initRes.ok) {
      throw new Error(`KASPI_AUTH_INIT:${initRes.status}`);
    }
    const initJson = (await initRes.json()) as Record<string, unknown>;
    const nested = asRecord(initJson.data);
    const processId = String(initJson.processId ?? nested?.processId ?? '');
    if (!processId) {
      throw new Error('KASPI_AUTH_NO_PROCESS_ID');
    }

    const sendRes = await fetch(`${base}/api/auth/send-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, processId }),
    });
    if (!sendRes.ok) {
      throw new Error(`KASPI_SEND_PHONE:${sendRes.status}`);
    }

    return { processId };
  }

  async verifyOtp(processId: string, otp: string): Promise<KaspiAuth> {
    const res = await fetch(`${this.baseUrl()}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId, otp }),
    });
    const data = (await res.json()) as Record<string, unknown>;

    const view = asRecord(data.view);
    if (view?.code === 'KPEnterLoginPassword') {
      throw new Error('KASPI_NEEDS_PASSWORD');
    }
    if (view?.code === 'KPMobileCall') {
      throw new Error('KASPI_NEEDS_MOBILE_CONFIRMATION');
    }

    const inner = asRecord(data.data) ?? data;
    const tokenSN = String(inner.tokenSN ?? '');
    const vtokenSecret = String(inner.vtokenSecret ?? '');
    const profileId = Number(inner.profileId ?? 0);
    const organizationId = Number(inner.organizationId ?? 0);

    if (!tokenSN || !vtokenSecret) {
      throw new Error('KASPI_OTP_FAILED');
    }

    this.auth = { tokenSN, vtokenSecret, profileId, organizationId };
    await this.persistAuth();
    return this.auth;
  }

  async createInvoice(
    phoneNumber: string,
    amount: number,
    comment: string,
  ): Promise<InvoiceResult> {
    if (!this.auth) {
      throw new Error('KASPI_NOT_AUTHENTICATED');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Token-SN': this.auth.tokenSN,
      'X-Vtoken-Secret': this.auth.vtokenSecret,
    };
    if (this.auth.profileId > 0) {
      headers['X-Profile-Id'] = String(this.auth.profileId);
    }

    const res = await fetch(`${this.baseUrl()}/api/invoice/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phoneNumber,
        amount,
        comment: comment || '',
      }),
    });

    const text = await res.text();
    this.logger.debug(`Invoice create raw response: ${text}`);
    let data: {
      StatusCode?: number;
      Data?: {
        Id?: string | number;
        QrOperationId?: string | number;
        Status?: string;
        Amount?: number;
        ClientMobile?: string;
        ReceiptUrl?: string;
        OrderNumber?: string;
      };
    };
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`KASPI_INVOICE_PARSE_ERROR:${text.slice(0, 200)}`);
    }

    if (data.StatusCode !== 0 || !data.Data) {
      throw new Error(`KASPI_INVOICE_ERROR:${data.StatusCode ?? res.status}`);
    }

    const d = data.Data;
    // Prefer Id, fall back to QrOperationId (used when invoice is QR-based)
    const invoiceId = d.Id != null ? String(d.Id) : String(d.QrOperationId ?? '');
    this.logger.log(`Invoice created: id=${invoiceId}, status=${d.Status}, receiptUrl=${d.ReceiptUrl}`);
    return {
      id: invoiceId || `unknown-${text.slice(0, 50)}`,
      status: String(d.Status ?? ''),
      amount: Number(d.Amount ?? 0),
      clientMobile: String(d.ClientMobile ?? ''),
      receiptUrl: String(d.ReceiptUrl ?? ''),
      orderNumber: String(d.OrderNumber ?? ''),
    };
  }

  async getInvoiceDetails(operationId: string): Promise<unknown> {
    if (!this.auth) throw new Error('KASPI_NOT_AUTHENTICATED');

    const q = new URLSearchParams({ operationId: String(operationId) });
    const res = await fetch(`${this.baseUrl()}/api/invoice/details?${q.toString()}`, {
      method: 'GET',
      headers: {
        'X-Token-SN': this.auth.tokenSN,
        'X-Vtoken-Secret': this.auth.vtokenSecret,
        ...(this.auth.profileId > 0 ? { 'X-Profile-Id': String(this.auth.profileId) } : {}),
      },
    });

    return res.json();
  }

  isAuthenticated(): boolean {
    return this.auth !== null;
  }

  async checkSession(): Promise<boolean> {
    if (!this.auth) return false;
    try {
      const res = await fetch(`${this.baseUrl()}/api/session/check`, {
        method: 'GET',
        headers: {
          'X-Token-SN': this.auth.tokenSN,
          'X-Vtoken-Secret': this.auth.vtokenSecret,
        },
      });
      if (!res.ok) return false;
      const j = (await res.json()) as { active?: boolean };
      return j.active === true;
    } catch {
      return false;
    }
  }
}