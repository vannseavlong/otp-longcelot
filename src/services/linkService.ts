import bcrypt from 'bcryptjs';
import { computeHmacHex } from '../utils/hmac.js';

export class LinkService {
  // tokenProvider(token) returns candidate link token rows for the given token
  constructor(public storage: any, public tokenProvider?: (token: string) => Promise<any[]>) {
    if (!this.tokenProvider) {
      this.tokenProvider = async (token: string) => {
        const { knex } = await import('../db/knex.js');
        const token_hmac = computeHmacHex(token);
        return await knex('link_tokens').where({ token_hmac, used: false }).andWhere('expires_at', '>', knex.fn.now());
      };
    }
  }

  async verifyAndConsume(token: string) {
    const candidates = await this.tokenProvider!(token);
    let matched: any = null;
    for (const lt of candidates) {
      if (bcrypt.compareSync(token, lt.token_hash)) {
        matched = lt;
        break;
      }
    }
    if (!matched) return null;
    // consume via storage
    const consumed = await this.storage.consumeLinkToken(matched.token_hash);
    return consumed;
  }
}
