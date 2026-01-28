import bcrypt from 'bcryptjs';
import { Storage } from './storage.js';
import { hmacSha256 } from './hmac.js';

export class RecoveryService {
  constructor(private storage: Storage) {}

  async addCodes(user_id: number, codes: string[]) {
    const hashes = codes.map((c) => bcrypt.hashSync(c, 12));
    await this.storage.addRecoveryCodes(user_id, hashes);
  }

  async consume(user_id: number, code: string) {
    throw new Error('Efficient recovery code lookup requires a deterministic index. See README notes.');
  }
}
