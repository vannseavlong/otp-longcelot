import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { KnexStorage } from '../adapters/knexStorage.js';
import { AuthService } from '../core/auth.js';
import { LinkService } from '../services/linkService.js';
import { knex } from '../db/knex.js';
import bcrypt from 'bcryptjs';

const storage = new KnexStorage();
const auth = new AuthService(storage);

export function createBot() {
  if (!config.telegramBotToken) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const bot = new Telegraf(config.telegramBotToken);

  bot.start(async (ctx) => {
    const text = ctx.message?.text || '';
    const parts = text.split(' ');
    const token = parts.length > 1 ? parts[1] : undefined;
    if (!token) {
      await ctx.reply('Welcome! Use the link token from the app to link your account: /start <token>');
      return;
    }
    // Use LinkService to find and consume matching token
    const linkService = new LinkService(storage);
    const matched = await linkService.verifyAndConsume(token);
    if (!matched) {
      await ctx.reply('Invalid or expired link token. Please initiate linking again from the app.');
      return;
    }
    // Use safeVerifyTelegram to tolerate possible race/unique-constraint conditions
    if ((storage as any).safeVerifyTelegram) {
      await (storage as any).safeVerifyTelegram(matched.user_id, String(ctx.chat?.id || ''), ctx.from?.username || null);
    } else {
      await storage.verifyTelegram(matched.user_id, String(ctx.chat?.id || ''), ctx.from?.username || null);
    }
    // Generate recovery codes on first link if none exist
    const existing = await knex('recovery_codes').where({ user_id: matched.user_id });
    if (!existing || existing.length === 0) {
      const codes = await auth.generateRecoveryCodes(matched.user_id);
      await ctx.reply('Your recovery codes (store securely, single-use):');
      for (const c of codes) {
        await ctx.reply(c);
      }
    }
    await ctx.reply('Telegram account linked successfully. You can now receive OTPs here.');
  });

  return bot;
}
