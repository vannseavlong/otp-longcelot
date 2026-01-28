import { knex } from '../db/knex.js';
import { Storage } from '../core/storage.js';
import { User, TelegramCredentials, OTPRequest, RecoveryCode, LinkToken } from '../core/types.js';

export class KnexStorage implements Storage {
  async createUser(email: string, username: string, password_hash: string): Promise<User> {
    // Different knex clients return different shapes for insert().
    // For Postgres we must use `.returning('id')` to get the inserted id(s).
    let id: number;
    try {
      // Prefer returning id (Postgres) — if client doesn't support it this will throw
      const rows: any[] = await knex('users').insert({ email, username, password_hash }).returning('id');
      const first = rows && rows[0];
      id = typeof first === 'object' ? (first.id ?? Object.values(first)[0]) : first;
    } catch (err) {
      // Fallback for clients that don't support returning (sqlite3): plain insert
      const res: any = await knex('users').insert({ email, username, password_hash });
      if (Array.isArray(res)) {
        const first = res[0];
        id = typeof first === 'object' ? (first.id ?? Object.values(first)[0]) : first;
      } else {
        id = res as number;
      }
    }
    return (await this.findUserById(id))!;
  }

  async findUserByEmailOrUsername(identifier: string): Promise<User | null> {
    const user = await knex('users')
      .where('email', identifier)
      .orWhere('username', identifier)
      .first();
    return user || null;
  }

  async findUserById(id: number): Promise<User | null> {
    const user = await knex('users').where({ id }).first();
    return user || null;
  }

  async getTelegramCredentials(user_id: number): Promise<TelegramCredentials | null> {
    const rec = await knex('telegram_credentials').where({ user_id }).first();
    return rec || null;
  }

  async upsertTelegramCredentials(user_id: number, data: Partial<TelegramCredentials>): Promise<TelegramCredentials> {
    const existing = await this.getTelegramCredentials(user_id);
    if (existing) {
      await knex('telegram_credentials').where({ user_id }).update(data);
    } else {
      await knex('telegram_credentials').insert({ user_id, ...data });
    }
    return (await this.getTelegramCredentials(user_id))!;
  }

  async verifyTelegram(user_id: number, chat_id: string, username?: string | null): Promise<TelegramCredentials> {
    // Ensure uniqueness of telegram_chat_id: if another user currently holds the same chat id,
    // clear that association first, then assign it to the requested user. Do this in a transaction
    // to avoid unique-constraint race conditions.
    await knex.transaction(async (trx) => {
      // Clear any other rows that have the same chat id (assigning chat to a different user)
      await trx('telegram_credentials')
        .where({ telegram_chat_id: chat_id })
        .andWhere('user_id', '!=', user_id)
        .update({ telegram_chat_id: null, telegram_username: null, is_verified: false, linked_at: null });

      const existing = await trx('telegram_credentials').where({ user_id }).first();
      if (existing) {
        await trx('telegram_credentials')
          .where({ user_id })
          .update({ telegram_chat_id: chat_id, telegram_username: username ?? null, is_verified: true, linked_at: trx.fn.now() });
      } else {
        await trx('telegram_credentials').insert({ user_id, telegram_chat_id: chat_id, telegram_username: username ?? null, is_verified: true, linked_at: trx.fn.now() });
      }
    });

    return (await this.getTelegramCredentials(user_id))!;
  }

  // In some edge cases (concurrent updates) a unique-constraint error may still surface.
  // Provide a safe wrapper that retries once after clearing any conflicting row.
  async safeVerifyTelegram(user_id: number, chat_id: string, username?: string | null): Promise<TelegramCredentials> {
    try {
      return await this.verifyTelegram(user_id, chat_id, username);
    } catch (err: any) {
      // If unique-constraint on telegram_chat_id, try to resolve by clearing the conflicting row and retrying
      if (err && /telegram_credentials_telegram_chat_id_unique/.test(err.message || '')) {
        const conflicting = await knex('telegram_credentials').where({ telegram_chat_id: chat_id }).first();
        if (conflicting && conflicting.user_id !== user_id) {
          await knex('telegram_credentials').where({ id: conflicting.id }).update({ telegram_chat_id: null, telegram_username: null, is_verified: false, linked_at: null });
        }
        // Retry once
        return await this.verifyTelegram(user_id, chat_id, username);
      }
      throw err;
    }
  }

  async revokeTelegram(user_id: number): Promise<void> {
    await knex('telegram_credentials').where({ user_id }).update({ telegram_chat_id: null, telegram_username: null, is_verified: false, linked_at: null });
  }

  async createOTP(user_id: number, otp_hash: string, expires_at: Date, context: OTPRequest['context']): Promise<OTPRequest> {
    let id: number;
    try {
      const rows: any[] = await knex('otp_requests').insert({ user_id, otp_hash, expires_at, used: false, context }).returning('id');
      const first = rows && rows[0];
      id = typeof first === 'object' ? (first.id ?? Object.values(first)[0]) : first;
    } catch (err) {
      const res: any = await knex('otp_requests').insert({ user_id, otp_hash, expires_at, used: false, context });
      if (Array.isArray(res)) {
        const first = res[0];
        id = typeof first === 'object' ? (first.id ?? Object.values(first)[0]) : first;
      } else {
        id = res as number;
      }
    }
    return (await this.getOTP(id))!;
  }

  async getOTP(id: number): Promise<OTPRequest | null> {
    const rec = await knex('otp_requests').where({ id }).first();
    return rec || null;
  }

  async markOTPUsed(id: number): Promise<void> {
    await knex('otp_requests').where({ id }).update({ used: true });
  }

  async addRecoveryCodes(user_id: number, codes_hashes: string[], codes_hmacs?: string[]): Promise<void> {
    const rows = codes_hashes.map((h, i) => ({ user_id, code_hash: h, code_hmac: codes_hmacs ? codes_hmacs[i] : null, used: false }));
    await knex('recovery_codes').insert(rows);
  }

  async consumeRecoveryCode(user_id: number, code_hash: string): Promise<boolean> {
    const rec = await knex('recovery_codes').where({ user_id, code_hash, used: false }).first();
    if (!rec) return false;
    await knex('recovery_codes').where({ id: rec.id }).update({ used: true });
    return true;
  }

  async createLinkToken(user_id: number, token_hash: string, token_hmac: string, expires_at: Date): Promise<LinkToken> {
    let id: number;
    try {
      const rows: any[] = await knex('link_tokens').insert({ user_id, token_hash, token_hmac, expires_at, used: false }).returning('id');
      const first = rows && rows[0];
      id = typeof first === 'object' ? (first.id ?? Object.values(first)[0]) : first;
    } catch (err) {
      const res: any = await knex('link_tokens').insert({ user_id, token_hash, token_hmac, expires_at, used: false });
      if (Array.isArray(res)) {
        const first = res[0];
        id = typeof first === 'object' ? (first.id ?? Object.values(first)[0]) : first;
      } else {
        id = res as number;
      }
    }
    const row = await knex('link_tokens').where({ id }).first();
    return row!;
  }

  async consumeLinkToken(token_hash: string): Promise<LinkToken | null> {
    const rec = await knex('link_tokens').where({ token_hash, used: false }).andWhere('expires_at', '>', knex.fn.now()).first();
    if (!rec) return null;
    await knex('link_tokens').where({ id: rec.id }).update({ used: true });
    return rec;
  }

  async getUserByTelegramChatId(chat_id: string): Promise<User | null> {
    const creds = await knex('telegram_credentials').where({ telegram_chat_id: chat_id, is_verified: true }).first();
    if (!creds) return null;
    return this.findUserById(creds.user_id);
  }
}
