import { User, TelegramCredentials, OTPRequest, RecoveryCode, LinkToken } from './types.js';

export interface Storage {
  // Users
  createUser(email: string, username: string, password_hash: string): Promise<User>;
  findUserByEmailOrUsername(identifier: string): Promise<User | null>;
  findUserById(id: number): Promise<User | null>;

  // Telegram credentials
  getTelegramCredentials(user_id: number): Promise<TelegramCredentials | null>;
  upsertTelegramCredentials(user_id: number, data: Partial<TelegramCredentials>): Promise<TelegramCredentials>;
  verifyTelegram(user_id: number, chat_id: string, username?: string | null): Promise<TelegramCredentials>;
  revokeTelegram(user_id: number): Promise<void>;

  // OTP
  createOTP(user_id: number, otp_hash: string, expires_at: Date, context: OTPRequest['context']): Promise<OTPRequest>;
  getOTP(id: number): Promise<OTPRequest | null>;
  markOTPUsed(id: number): Promise<void>;

  // Recovery codes
  addRecoveryCodes(user_id: number, codes_hashes: string[], codes_hmacs?: string[]): Promise<void>;
  consumeRecoveryCode(user_id: number, code_hash: string): Promise<boolean>;

  // Link tokens
  createLinkToken(user_id: number, token_hash: string, token_hmac: string, expires_at: Date): Promise<LinkToken>;
  consumeLinkToken(token_hash: string): Promise<LinkToken | null>;

  // Utility
  getUserByTelegramChatId(chat_id: string): Promise<User | null>;
}
