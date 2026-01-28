import bcrypt from 'bcryptjs';
import { computeHmacHex } from '../utils/hmac.js';

export class RecoveryService {
  constructor(public storage: any, public codesProvider?: (user_id: number) => Promise<any[]>) {
    if (!this.codesProvider) {
      this.codesProvider = async (user_id: number) => {
        const { knex } = await import('../db/knex.js');
        return await knex('recovery_codes').where({ user_id, used: false });
      };
    }
  }

  async addCodes(user_id: number, codes: string[]) {
    const hashes = codes.map((c) => bcrypt.hashSync(c, 12));
    const hmacs = codes.map((c) => computeHmacHex(c));
    await this.storage.addRecoveryCodes(user_id, hashes, hmacs);
  }

  async consume(user_id: number, code: string) {
    // Try deterministic lookup by HMAC first to avoid scanning all codes
    try {
      const { knex } = await import('../db/knex.js');
      const code_hmac = computeHmacHex(code);
      const rec = await knex('recovery_codes').where({ user_id, code_hmac, used: false }).first();
      if (rec && bcrypt.compareSync(code, rec.code_hash)) {
        return await this.storage.consumeRecoveryCode(user_id, rec.code_hash);
      }
    } catch (e) {
      // fallback to scanning provider (older DBs without hmac column)
    }

    const codes = await this.codesProvider!(user_id);
    for (const rc of codes) {
      if (bcrypt.compareSync(code, rc.code_hash)) {
        const ok = await this.storage.consumeRecoveryCode(user_id, rc.code_hash);
        return ok;
      }
    }
    return false;
  }
}
