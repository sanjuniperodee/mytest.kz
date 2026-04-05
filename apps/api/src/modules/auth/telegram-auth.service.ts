import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface TelegramInitData {
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  auth_date: number;
  hash: string;
}

@Injectable()
export class TelegramAuthService {
  private readonly botToken: string;

  constructor(private config: ConfigService) {
    this.botToken = config.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  validateInitData(initDataRaw: string): TelegramInitData | null {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');

    if (!hash) return null;

    params.delete('hash');
    const dataCheckArr = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(this.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    // Check auth_date is not too old (allow 24 hours)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    try {
      const user = JSON.parse(userStr);
      return { user, auth_date: authDate, hash };
    } catch {
      return null;
    }
  }
}
