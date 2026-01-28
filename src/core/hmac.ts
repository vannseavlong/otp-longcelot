import crypto from 'crypto';
import { config } from '../config.js';

const KEY = config.jwtSecret; // reuse secret for HMAC namespacing; recommend separate secret in prod.

export function hmacSha256(value: string) {
  return crypto.createHmac('sha256', KEY).update(value).digest('hex');
}
