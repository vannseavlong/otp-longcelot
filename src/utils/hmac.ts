import crypto from 'crypto';
import { hmacSecret } from '../config.js';

export function computeHmacHex(value: string) {
  const key = hmacSecret;
  if (!key) throw new Error('HMAC secret not configured');
  return crypto.createHmac('sha256', key).update(value).digest('hex');
}
