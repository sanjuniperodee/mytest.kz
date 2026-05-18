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

export interface QrResult {
  id: string | number;
  status: string;
  amount: number;
  qrToken: string;
  receiptUrl: string;
  expiresAt: string;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function getString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
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

  private sessionHeaders(contentType?: string): Record<string, string> {
    if (!this.auth) {
      throw new Error('KASPI_NOT_AUTHENTICATED');
    }

    const headers: Record<string, string> = {
      'X-Token-SN': this.auth.tokenSN,
      'X-Vtoken-Secret': this.auth.vtokenSecret,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    if (this.auth.profileId > 0) {
      headers['X-Profile-Id'] = String(this.auth.profileId);
    }
    return headers;
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
    const res = await fetch(`${this.baseUrl()}/api/invoice/create`, {
      method: 'POST',
      headers: this.sessionHeaders('application/json'),
      body: JSON.stringify({
        phoneNumber,
        amount,
        comment: comment || '',
      }),
    });

    const text = await res.text();
    this.logger.debug(`Invoice create raw response: ${text}`);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`KASPI_INVOICE_PARSE_ERROR:${text.slice(0, 200)}`);
    }

    const statusCode = Number(data.StatusCode ?? data.statusCode ?? 0);
    const d = asRecord(data.Data) ?? asRecord(data.data);
    if (statusCode !== 0 || !d) {
      throw new Error(`KASPI_INVOICE_ERROR:${data.StatusCode ?? data.statusCode ?? res.status}`);
    }

    const invoiceId = getString(
      d.Id,
      d.id,
      d.QrOperationId,
      d.qrOperationId,
      d.OperationId,
      d.operationId,
      data.invoiceId,
      data.paymentId,
    );
    if (!invoiceId) {
      throw new Error(`KASPI_INVOICE_NO_ID:${text.slice(0, 200)}`);
    }

    const receiptUrl = getString(
      d.ReceiptUrl,
      d.receiptUrl,
      d.CheckoutUrl,
      d.checkoutUrl,
      d.PaymentUrl,
      d.paymentUrl,
      d.Url,
      d.url,
    );
    const orderNumber = getString(d.OrderNumber, d.orderNumber, d.OrderNo, d.orderNo);
    const status = getString(d.Status, d.status);
    this.logger.log(`Invoice created: id=${invoiceId}, status=${status}, receiptUrl=${receiptUrl}`);
    return {
      id: invoiceId,
      status,
      amount: Number(d.Amount ?? d.amount ?? 0),
      clientMobile: getString(d.ClientMobile, d.clientMobile),
      receiptUrl,
      orderNumber,
    };
  }

  async createQr(amount: number): Promise<QrResult> {
    const res = await fetch(`${this.baseUrl()}/api/qr/create`, {
      method: 'POST',
      headers: this.sessionHeaders('application/json'),
      body: JSON.stringify({ amount }),
    });

    const text = await res.text();
    this.logger.debug(`QR create raw response: ${text}`);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`KASPI_QR_PARSE_ERROR:${text.slice(0, 200)}`);
    }

    const statusCode = Number(data.StatusCode ?? data.statusCode ?? 0);
    const d = asRecord(data.Data) ?? asRecord(data.data);
    if (statusCode !== 0 || !d) {
      throw new Error(`KASPI_QR_ERROR:${data.StatusCode ?? data.statusCode ?? res.status}`);
    }

    const qrOperationId = getString(
      d.QrOperationId,
      d.qrOperationId,
      d.Id,
      d.id,
      data.qrOperationId,
      data.paymentId,
    );
    if (!qrOperationId) {
      throw new Error(`KASPI_QR_NO_ID:${text.slice(0, 200)}`);
    }

    return {
      id: qrOperationId,
      status: getString(d.Status, d.status),
      amount: Number(d.Amount ?? d.amount ?? amount),
      qrToken: getString(d.QrToken, d.qrToken, d.PaymentUrl, d.paymentUrl, d.Url, d.url),
      receiptUrl: getString(d.ReceiptUrl, d.receiptUrl),
      expiresAt: getString(d.ExpireDate, d.expireDate, d.ExpiresAt, d.expiresAt),
    };
  }

  async getInvoiceDetails(operationId: string): Promise<unknown> {
    const q = new URLSearchParams({ operationId: String(operationId) });
    const res = await fetch(`${this.baseUrl()}/api/invoice/details?${q.toString()}`, {
      method: 'GET',
      headers: this.sessionHeaders(),
    });

    return res.json();
  }

  async getQrStatus(qrOperationId: string): Promise<unknown> {
    const q = new URLSearchParams({ qrOperationId: String(qrOperationId) });
    const res = await fetch(`${this.baseUrl()}/api/qr/status?${q.toString()}`, {
      method: 'GET',
      headers: this.sessionHeaders(),
    });

    return res.json();
  }

  async cancelInvoice(operationId: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}/api/invoice/cancel`, {
      method: 'POST',
      headers: this.sessionHeaders('application/json'),
      body: JSON.stringify({ operationId: String(operationId) }),
    });

    const text = await res.text();
    this.logger.debug(`Invoice cancel raw response: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`KASPI_CANCEL_PARSE_ERROR:${text.slice(0, 200)}`);
    }
  }

  async refundInvoice(operationId: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl()}/api/invoice/refund`, {
      method: 'POST',
      headers: this.sessionHeaders('application/json'),
      body: JSON.stringify({ operationId: String(operationId) }),
    });

    const text = await res.text();
    this.logger.debug(`Invoice refund raw response: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`KASPI_REFUND_PARSE_ERROR:${text.slice(0, 200)}`);
    }
  }

  isAuthenticated(): boolean {
    return this.auth !== null;
  }

  async checkSession(): Promise<boolean> {
    if (!this.auth) return false;
    try {
      const res = await fetch(`${this.baseUrl()}/api/session/check`, {
        method: 'GET',
        headers: this.sessionHeaders(),
      });
      if (!res.ok) return false;
      const j = (await res.json()) as { active?: boolean };
      return j.active === true;
    } catch {
      return false;
    }
  }
}
