import { Request, Response } from 'express';
import { KnexStorage } from '../adapters/knexStorage.js';
import { AuthService as ServiceAuth } from '../services/authService.js';
import { Telegraf } from 'telegraf';
import { computeHmacHex } from '../utils/hmac.js';
import bcrypt from 'bcryptjs';

export function createAuthController(deps: {
  storage: KnexStorage;
  auth: ServiceAuth;
  bot: Telegraf | null;
  limiter: any;
}) {
  const { storage, auth, bot, limiter } = deps;

  async function register(req: Request, res: Response) {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });
    try {
      const user = await auth.register(email, username, password);
      res.status(201).json({ user });
    } catch (err: any) {
      // Handle DB unique constraint (Postgres 23505) or sqlite unique errors
      const msg = String(err && (err.message || err));
      if (err && (err.code === '23505' || /unique constraint/i.test(msg) || /UNIQUE constraint failed/i.test(msg))) {
        return res.status(409).json({ error: 'User already exists' });
      }
      // Re-throw so central error handler can log and respond
      throw err;
    }
  }

  async function login(req: Request, res: Response) {
    try {
      await limiter.consume((req.ip as string) || 'unknown');
    } catch {
      return res.status(429).json({ error: 'Too many requests' });
    }
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ error: 'Missing fields' });
    const result = await auth.validatePasswordAndSendLoginOTP(identifier, password);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    const { user, otp, requestId, expires_at } = result;
    let otpSent = false;
    if (bot) {
      otpSent = await auth.verifyAndSendOtpToTelegram(user.id, otp);
    }
    const response: any = { challengeId: requestId, expires_at, otpSent };
    if (process.env.DEBUG_OTP === 'true') response.debug_otp = otp;
    res.json(response);
  }

  async function verifyOtp(req: Request, res: Response) {
    const { challengeId, otp } = req.body || {};
    if (!challengeId || !otp) return res.status(400).json({ error: 'Missing fields' });
    const result = await auth.verifyOTP(challengeId, otp);
    if (!result) return res.status(400).json({ error: 'Invalid or expired OTP' });
    res.json({ token: result.token });
  }

  async function otpInitiate(req: Request, res: Response) {
    const { identifier, password, context } = req.body || {};
    if (!identifier || !password || !context) return res.status(400).json({ error: 'Missing fields' });
    const result = await auth.validatePasswordAndSendLoginOTP(identifier, password, 120, context);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    const { user, otp, requestId, expires_at } = result;
    if (bot) {
      await auth.verifyAndSendOtpToTelegram(user.id, otp, context);
    }
    const response: any = { challengeId: requestId, expires_at };
    if (process.env.DEBUG_OTP === 'true') response.debug_otp = otp;
    res.json(response);
  }

  async function initiateLink(req: Request, res: Response) {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    const { token, expires_at } = await auth.initiateLinkToken(user_id);
    let link_url: string | undefined = undefined;
    if (bot) {
      try {
        const me = await bot.telegram.getMe();
        if (me && (me as any).username) link_url = `https://t.me/${(me as any).username}?start=${token}`;
      } catch (e) {
        console.warn('Failed to build bot deep link:', (e as Error).message);
      }
    }
    const response: any = { link_token: token, expires_at };
    if (link_url) response.link_url = link_url;
    res.json(response);
  }

  async function changeInitiate(req: Request, res: Response) {
    const { identifier, password } = req.body || {};
    const result = await auth.validatePasswordAndSendLoginOTP(identifier, password, 120, 'telegram_change');
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    const { user, otp, requestId } = result;
    if (bot) {
      const creds = await storage.getTelegramCredentials(user.id);
      if (creds?.is_verified && creds.telegram_chat_id) {
        try {
          await bot.telegram.sendMessage(String(creds.telegram_chat_id), `OTP to confirm Telegram change: ${otp}`);
        } catch (e) {
          console.warn('Failed to send OTP via Telegram:', (e as Error).message);
        }
      }
    }
    const response: any = { challengeId: requestId };
    if (process.env.DEBUG_OTP === 'true') response.debug_otp = otp;
    res.json(response);
  }

  async function changeConfirm(req: Request, res: Response) {
    const { challengeId, otp } = req.body || {};
    const result = await auth.verifyOTP(challengeId, otp);
    if (!result) return res.status(400).json({ error: 'Invalid or expired OTP' });
    await storage.revokeTelegram(result.user.id);
    res.json({ ok: true, message: 'Old Telegram revoked. Initiate new linking.' });
  }

  async function recoverVerify(req: Request, res: Response) {
    const { identifier, recovery_code } = req.body || {};
    if (!identifier || !recovery_code) return res.status(400).json({ error: 'Missing fields' });
    const user = await storage.findUserByEmailOrUsername(identifier);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Try deterministic HMAC lookup first (fast path)
    try {
      const code_hmac = computeHmacHex(recovery_code);
      const rc = await (storage as any).knex('recovery_codes').where({ user_id: user.id, code_hmac, used: false }).first();
      if (rc && bcrypt.compareSync(recovery_code, rc.code_hash)) {
        await (storage as any).knex('recovery_codes').where({ id: rc.id }).update({ used: true });
      } else {
        // fallback to scanning if no match
        const codes = await (storage as any).knex('recovery_codes').where({ user_id: user.id, used: false });
        let valid = false;
        for (const c of codes) {
          if (bcrypt.compareSync(recovery_code, c.code_hash)) {
            valid = true;
            await (storage as any).knex('recovery_codes').where({ id: c.id }).update({ used: true });
            break;
          }
        }
        if (!valid) return res.status(400).json({ error: 'Invalid recovery code' });
      }
      await storage.revokeTelegram(user.id);
    } catch (e) {
      // In case HMAC not configured or DB lacks column, fallback to old scan
      const codes = await (storage as any).knex('recovery_codes').where({ user_id: user.id, used: false });
      let valid = false;
      for (const rc of codes) {
        if (bcrypt.compareSync(recovery_code, rc.code_hash)) {
          valid = true;
          await (storage as any).knex('recovery_codes').where({ id: rc.id }).update({ used: true });
          break;
        }
      }
      if (!valid) return res.status(400).json({ error: 'Invalid recovery code' });
      await storage.revokeTelegram(user.id);
    }
    res.json({ ok: true, message: 'Recovery verified. Initiate linking with new Telegram.' });
  }

  return {
    register,
    login,
    verifyOtp,
    otpInitiate,
    initiateLink,
    changeInitiate,
    changeConfirm,
    recoverVerify,
  };
}
