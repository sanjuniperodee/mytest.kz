import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const KASPI_API_BASE = process.env.KASPI_API_URL || 'http://localhost:3032';
const AUTH_FILE = path.join(process.cwd(), 'kaspi-auth.json');

interface KaspiAuth {
  tokenSN: string;
  vtokenSecret: string;
  profileId: number;
  organizationId: number;
}

interface InvoiceResult {
  id: string | number;
  status: string;
  amount: number;
  clientMobile: string;
  receiptUrl: string;
  orderNumber: string;
}

export class KaspiPosService {
  private auth: KaspiAuth | null = null;

  constructor() {
    this.loadAuth();
  }

  private saveAuth(auth: KaspiAuth): void {
    try {
      fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
    } catch {}
  }

  private loadAuth(): void {
    try {
      if (fs.existsSync(AUTH_FILE)) {
        this.auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as KaspiAuth;
      }
    } catch {
      this.auth = null;
    }
  }

  clearAuth(): void {
    this.auth = null;
    try {
      if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);
    } catch {}
  }

  async initAuth(phoneNumber: string): Promise<{ processId: string }> {
    const initRes = await fetch(`${KASPI_API_BASE}/api/auth/init`, {
      method: 'POST',
    });
    const initData = await initRes.json() as { data: { processId: string } };
    const processId = initData.data.processId;

    await fetch(`${KASPI_API_BASE}/api/auth/send-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, processId }),
    });

    return { processId };
  }

  async verifyOtp(processId: string, otpCode: string): Promise<KaspiAuth> {
    const res = await fetch(`${KASPI_API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId, otpCode }),
    });
    const data = await res.json() as {
      data: {
        tokenSN: string;
        vtokenSecret: string;
        profileId: number;
        organizationId: number;
      };
      type: string;
      view?: { code: string };
    };

    if (data.view?.code === 'KPEnterLoginPassword') {
      throw new Error('KASPI_NEEDS_PASSWORD');
    }

    if (data.view?.code === 'KPMobileCall') {
      throw new Error('KASPI_NEEDS_MOBILE_CONFIRMATION');
    }

    this.auth = {
      tokenSN: data.data.tokenSN,
      vtokenSecret: data.data.vtokenSecret,
      profileId: data.data.profileId,
      organizationId: data.data.organizationId,
    };
    this.saveAuth(this.auth);
    return this.auth;
  }

  async createInvoice(phoneNumber: string, amount: number, comment: string): Promise<InvoiceResult> {
    if (!this.auth) {
      throw new Error('KASPI_NOT_AUTHENTICATED');
    }

    const res = await fetch(`${KASPI_API_BASE}/api/invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token-SN': this.auth.tokenSN,
        'X-Vtoken-Secret': this.auth.vtokenSecret,
        'X-Profile-Id': String(this.auth.profileId),
      },
      body: JSON.stringify({ PhoneNumber: phoneNumber, Amount: amount, Comment: comment || '' }),
    });

    const data = await res.json() as {
      StatusCode: number;
      Data: {
        Id: string | number;
        Status: string;
        Amount: number;
        ClientMobile: string;
        ReceiptUrl: string;
        OrderNumber: string;
      };
    };

    if (data.StatusCode !== 0) {
      throw new Error(`KASPI_INVOICE_ERROR:${data.StatusCode}`);
    }

    return {
      id: data.Data.Id,
      status: data.Data.Status,
      amount: data.Data.Amount,
      clientMobile: data.Data.ClientMobile,
      receiptUrl: data.Data.ReceiptUrl,
      orderNumber: data.Data.OrderNumber,
    };
  }

  async getInvoiceDetails(invoiceId: string): Promise<unknown> {
    if (!this.auth) throw new Error('KASPI_NOT_AUTHENTICATED');

    const res = await fetch(`${KASPI_API_BASE}/api/invoice/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token-SN': this.auth.tokenSN,
        'X-Vtoken-Secret': this.auth.vtokenSecret,
        'X-Profile-Id': String(this.auth.profileId),
      },
      body: JSON.stringify({ id: invoiceId }),
    });

    return res.json();
  }

  isAuthenticated(): boolean {
    return this.auth !== null;
  }

  async checkSession(): Promise<boolean> {
    if (!this.auth) return false;
    try {
      const res = await fetch(`${KASPI_API_BASE}/api/session/check`, {
        headers: {
          'X-Token-SN': this.auth.tokenSN,
          'X-Vtoken-Secret': this.auth.vtokenSecret,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}