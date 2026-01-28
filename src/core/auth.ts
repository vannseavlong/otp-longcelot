import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Storage } from './storage.js';
import { config } from '../config.js';
import { computeHmacHex } from '../utils/hmac.js';

function randomDigits(length: number): string {
  let s = '';
  while (s.length < length) s += Math.floor(Math.random() * 10);
  return s.slice(0, length);
}

function randomCode(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class AuthService {
  constructor(private storage: Storage) {}

  async register(email: string, username: string, password: string) {
    const hash = bcrypt.hashSync(password, 12);
    const user = await this.storage.createUser(email, username, hash);
    await this.storage.upsertTelegramCredentials(user.id, {});
    return { id: user.id, email: user.email, username: user.username };
  }

  async initiateLinkToken(user_id: number, ttlSeconds = 600) {
    const token = randomCode(24);
    const tokenHash = bcrypt.hashSync(token, 12);
    const expires = new Date(Date.now() + ttlSeconds * 1000);
    const token_hmac = computeHmacHex(token);
    await this.storage.createLinkToken(user_id, tokenHash, token_hmac, expires);
    return { token, expires_at: expires.toISOString() };
  }

  async verifyLinkTokenAndBind(token: string, chat_id: string, telegram_username?: string) {
    // We cannot compare argon2 hashes directly; scan link tokens is not feasible.
    // Strategy: store token_hash and verify by trying argon2.verify against all non-used tokens — inefficient.
    // To keep semantics and performance, we instead hash token and match by hash using argon2id password-like hashes.
    // However argon2 hashes are salted, so deterministic matching is impossible.
    // Adjust: store bcrypt-like? Alternatively store a keyed HMAC of token for lookup and keep a separate argon2 for secrecy.
    // Minimal extension: use SHA256 HMAC for lookup and argon2 for secrecy. We'll implement lookup via HMAC.
    throw new Error('Not implemented in this file. Use authLink.ts utility for secure token lookup.');
  }

  async validatePasswordAndSendLoginOTP(identifier: string, password: string, ttlSeconds = 120, context: 'login' | 'sensitive' | 'telegram_change' = 'login') {
    const user = await this.storage.findUserByEmailOrUsername(identifier);
    if (!user) return null;
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return null;

    const otp = randomDigits(6);
    const otpHash = bcrypt.hashSync(otp, 12);
    const expires = new Date(Date.now() + ttlSeconds * 1000);
    const req = await this.storage.createOTP(user.id, otpHash, expires, context);
    return { user, otp, requestId: req.id, expires_at: expires.toISOString() };
  }

  async verifyOTP(requestId: number, otp: string) {
    const rec = await this.storage.getOTP(requestId);
    if (!rec || rec.used) return null;
    if (new Date(rec.expires_at).getTime() < Date.now()) return null;
    const ok = bcrypt.compareSync(otp, rec.otp_hash);
    if (!ok) return null;
    await this.storage.markOTPUsed(rec.id);
    const user = await this.storage.findUserById(rec.user_id);
    if (!user) return null;
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '1h' });
    return { user, token };
  }

  async generateRecoveryCodes(user_id: number, count = 8) {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = `RC-${randomCode(4)}-${randomCode(4)}`;
      codes.push(code);
      hashes.push(bcrypt.hashSync(code, 12));
    }
    const hmacs = codes.map((c) => computeHmacHex(c));
    await this.storage.addRecoveryCodes(user_id, hashes, hmacs);
    return codes; // Important: display only once.
  }

  async consumeRecoveryCode(user_id: number, code: string) {
    // Argon2 hash lookup problem again. For recovery codes, we need deterministic lookup.
    // As with link tokens, we will use HMAC-based lookup in a separate utility.
    throw new Error('Not implemented here. See recovery service with HMAC lookup.');
  }
}
