import bcrypt from 'bcryptjs';
import { Storage } from './storage.js';
import crypto from 'crypto';
import { computeHmacHex } from '../utils/hmac.js';

export class LinkService {
  constructor(private storage: Storage) {}

  async createToken(user_id: number, ttlSeconds = 600) {
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = bcrypt.hashSync(token, 12);
    const expires = new Date(Date.now() + ttlSeconds * 1000);
    const token_hmac = computeHmacHex(token);
    await this.storage.createLinkToken(user_id, tokenHash, token_hmac, expires);
    return { token, expires_at: expires.toISOString() };
  }
}
