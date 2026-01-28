import { KnexStorage } from '../adapters/knexStorage.js';
import { AuthService as CoreAuthService } from '../core/auth.js';
import { Telegraf } from 'telegraf';

export class AuthService {
  core: CoreAuthService;
  constructor(public storage: KnexStorage, public bot: Telegraf | null, public limiter: any) {
    this.core = new CoreAuthService(storage);
  }

  async register(email: string, username: string, password: string) {
    return this.core.register(email, username, password);
  }

  async initiateLinkToken(user_id: number) {
    return this.core.initiateLinkToken(user_id);
  }

  async validatePasswordAndSendLoginOTP(identifier: string, password: string, ttlSeconds = 120, context: string = 'login') {
    return this.core.validatePasswordAndSendLoginOTP(identifier, password, ttlSeconds as any, context as any);
  }

  async verifyOTP(requestId: number, otp: string) {
    return this.core.verifyOTP(requestId, otp as any);
  }

  async generateRecoveryCodes(user_id: number, count = 8) {
    return this.core.generateRecoveryCodes(user_id, count);
  }

  async verifyAndSendOtpToTelegram(userId: number, otp: string, context?: string) {
    if (!this.bot) return false;
    const creds = await this.storage.getTelegramCredentials(userId);
    if (!creds?.is_verified || !creds.telegram_chat_id) return false;
    try {
      await this.bot.telegram.sendMessage(String(creds.telegram_chat_id), `Your OTP${context ? ' for ' + context : ''}: ${otp}`);
      return true;
    } catch (e) {
      console.warn('Failed to send OTP via Telegram:', (e as Error).message);
      return false;
    }
  }
}
