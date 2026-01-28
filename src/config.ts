import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  debugOtp: process.env.DEBUG_OTP === 'true',
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(process.env.RATE_LIMIT_MAX || 10)
  },
  db: {
    client: process.env.DATABASE_CLIENT || 'sqlite3',
    connection: process.env.DATABASE_URL || './data/dev.sqlite'
  },
  bot: {
    mode: process.env.BOT_MODE || 'polling',
    webhookUrl: process.env.WEBHOOK_URL || ''
  }
};

// HMAC key for deterministic lookup of tokens/recovery codes
export const hmacSecret = process.env.HMAC_SECRET || process.env.JWT_SECRET || 'change_me';
