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

  private requestTimeoutMs(kind: 'auth' | 'read' | 'write'): number {
    const fallback =
      kind === 'auth' ? 10_000 : kind === 'write' ? 8_000 : 5_000;
    const specificKey =
      kind === 'auth'
        ? 'KASPI_POS_AUTH_TIMEOUT_MS'
        : kind === 'write'
          ? 'KASPI_POS_WRITE_TIMEOUT_MS'
          : 'KASPI_POS_READ_TIMEOUT_MS';
    const specific = Number(this.config.get<string>(specificKey));
    if (Number.isFinite(specific) && specific > 0) {
      return Math.floor(specific);
    }

    const shared = Number(this.config.get<string>('KASPI_POS_TIMEOUT_MS'));
    if (Number.isFinite(shared) && shared > 0) {
      return Math.floor(shared);
    }

    return fallback;
  }

  private normalizeSnippet(text: string): string {
    return text.replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  private upstreamError(operation: string, status: number, text: string): Error {
    if ([502, 503, 504].includes(status)) {
      return new Error(`${operation}_UPSTREAM_TIMEOUT:${status}`);
    }
    return new Error(`${operation}_HTTP_${status}:${this.normalizeSnippet(text)}`);
  }

  private async requestText(
    path: string,
    init: RequestInit,
    operation: string,
    timeoutMs: number,
  ): Promise<{ response: Response; text: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const text = await response.text();
      return { response, text };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${operation}_TIMEOUT`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${operation}_UNAVAILABLE:${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseJson(text: string, operation: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const snippet = this.normalizeSnippet(text);
      if (
        snippet.includes('504 Gateway Time-out') ||
        snippet.includes('502 Bad Gateway') ||
        snippet.includes('503 Service Temporarily Unavailable')
      ) {
        throw new Error(`${operation}_UPSTREAM_TIMEOUT_HTML`);
      }
      throw new Error(`${operation}_PARSE_ERROR:${snippet}`);
    }
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
    const { response: initRes, text: initText } = await this.requestText(
      '/api/auth/init',
      { method: 'POST' },
      'KASPI_AUTH_INIT',
      this.requestTimeoutMs('auth'),
    );
    if (!initRes.ok) {
      throw this.upstreamError('KASPI_AUTH_INIT', initRes.status, initText);
    }
    const initJson = this.parseJson(initText, 'KASPI_AUTH_INIT');
    const nested = asRecord(initJson.data);
    const processId = String(initJson.processId ?? nested?.processId ?? '');
    if (!processId) {
      throw new Error('KASPI_AUTH_NO_PROCESS_ID');
    }

    const { response: sendRes, text: sendText } = await this.requestText(
      '/api/auth/send-phone',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, processId }),
      },
      'KASPI_SEND_PHONE',
      this.requestTimeoutMs('auth'),
    );
    if (!sendRes.ok) {
      throw this.upstreamError('KASPI_SEND_PHONE', sendRes.status, sendText);
    }

    return { processId };
  }

  async verifyOtp(processId: string, otp: string): Promise<KaspiAuth> {
    const { response: res, text } = await this.requestText(
      '/api/auth/verify-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId, otp }),
      },
      'KASPI_VERIFY_OTP',
      this.requestTimeoutMs('auth'),
    );
    if (!res.ok) {
      throw this.upstreamError('KASPI_VERIFY_OTP', res.status, text);
    }
    const data = this.parseJson(text, 'KASPI_VERIFY_OTP');

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
    const { response: res, text } = await this.requestText(
      '/api/invoice/create',
      {
        method: 'POST',
        headers: this.sessionHeaders('application/json'),
        body: JSON.stringify({
          phoneNumber,
          amount,
          comment: comment || '',
        }),
      },
      'KASPI_INVOICE_CREATE',
      this.requestTimeoutMs('write'),
    );
    this.logger.debug(`Invoice create raw response: ${text}`);
    if (!res.ok) {
      throw this.upstreamError('KASPI_INVOICE_CREATE', res.status, text);
    }
    const data = this.parseJson(text, 'KASPI_INVOICE_CREATE');

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
    const { response: res, text } = await this.requestText(
      '/api/qr/create',
      {
        method: 'POST',
        headers: this.sessionHeaders('application/json'),
        body: JSON.stringify({ amount }),
      },
      'KASPI_QR_CREATE',
      this.requestTimeoutMs('write'),
    );
    this.logger.debug(`QR create raw response: ${text}`);
    if (!res.ok) {
      throw this.upstreamError('KASPI_QR_CREATE', res.status, text);
    }
    const data = this.parseJson(text, 'KASPI_QR_CREATE');

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
    const { response: res, text } = await this.requestText(
      `/api/invoice/details?${q.toString()}`,
      {
        method: 'GET',
        headers: this.sessionHeaders(),
      },
      'KASPI_INVOICE_DETAILS',
      this.requestTimeoutMs('read'),
    );
    if (!res.ok) {
      throw this.upstreamError('KASPI_INVOICE_DETAILS', res.status, text);
    }

    return this.parseJson(text, 'KASPI_INVOICE_DETAILS');
  }

  async getQrStatus(qrOperationId: string): Promise<unknown> {
    const q = new URLSearchParams({ qrOperationId: String(qrOperationId) });
    const { response: res, text } = await this.requestText(
      `/api/qr/status?${q.toString()}`,
      {
        method: 'GET',
        headers: this.sessionHeaders(),
      },
      'KASPI_QR_STATUS',
      this.requestTimeoutMs('read'),
    );
    if (!res.ok) {
      throw this.upstreamError('KASPI_QR_STATUS', res.status, text);
    }

    return this.parseJson(text, 'KASPI_QR_STATUS');
  }

  async cancelInvoice(operationId: string): Promise<unknown> {
    const { response: res, text } = await this.requestText(
      '/api/invoice/cancel',
      {
        method: 'POST',
        headers: this.sessionHeaders('application/json'),
        body: JSON.stringify({ operationId: String(operationId) }),
      },
      'KASPI_CANCEL',
      this.requestTimeoutMs('write'),
    );
    this.logger.debug(`Invoice cancel raw response: ${text}`);
    if (!res.ok) {
      throw this.upstreamError('KASPI_CANCEL', res.status, text);
    }
    return this.parseJson(text, 'KASPI_CANCEL');
  }

  async refundInvoice(operationId: string, returnAmount: number): Promise<unknown> {
    const headers = this.sessionHeaders('application/json');
    const { response: primaryRes, text: primaryText } = await this.requestText(
      '/api/invoice/refund',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ operationId: String(operationId) }),
      },
      'KASPI_REFUND',
      this.requestTimeoutMs('write'),
    );
    this.logger.debug(`Invoice refund raw response: ${primaryText}`);
    const isMissingPrimaryRoute =
      primaryRes.status === 404 && primaryText.includes('Cannot POST /api/invoice/refund');

    if (!isMissingPrimaryRoute) {
      if (!primaryRes.ok) {
        throw this.upstreamError('KASPI_REFUND', primaryRes.status, primaryText);
      }
      return this.parseJson(primaryText, 'KASPI_REFUND');
    }

    const { response: legacyRes, text: legacyText } = await this.requestText(
      '/api/refund/create',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          qrOperationId: Number(operationId),
          returnAmount: Number(returnAmount),
        }),
      },
      'KASPI_REFUND_LEGACY',
      this.requestTimeoutMs('write'),
    );
    this.logger.debug(`Refund create raw response: ${legacyText}`);
    if (!legacyRes.ok) {
      throw this.upstreamError('KASPI_REFUND_LEGACY', legacyRes.status, legacyText);
    }
    return this.parseJson(legacyText, 'KASPI_REFUND_LEGACY');
  }

  isAuthenticated(): boolean {
    return this.auth !== null;
  }

  async checkSession(): Promise<boolean> {
    if (!this.auth) return false;
    try {
      const { response: res, text } = await this.requestText(
        '/api/session/check',
        {
          method: 'GET',
          headers: this.sessionHeaders(),
        },
        'KASPI_SESSION_CHECK',
        this.requestTimeoutMs('read'),
      );
      if (!res.ok) return false;
      const j = this.parseJson(text, 'KASPI_SESSION_CHECK') as { active?: boolean };
      return j.active === true;
    } catch {
      return false;
    }
  }
}
