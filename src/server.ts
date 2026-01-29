import { config } from './config.js';
import { KnexStorage } from './adapters/knexStorage.js';
import { AuthService } from './core/auth.js';
import { createBot } from './telegram/bot.js';
import createApp from './app.js';
import { Telegraf } from 'telegraf';
import { limiter } from './middlewares/rateLimiter.js';
import { knex } from './db/knex.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../migrations');

process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});

async function main() {
  // Run any pending migrations so DB schema matches code expectations (adds HMAC columns)
  try {
    await knex.migrate.latest({ directory: migrationsDir });
    console.log('Migrations applied');
  } catch (e) {
    console.warn('Migrations failed or were not applied:', (e as Error).message);
  }

  const storage = new KnexStorage();
  console.log('KnexStorage initialized');
  const auth = new AuthService(storage);
  console.log('AuthService initialized');

  // `limiter` imported from middlewares/rateLimiter

  let bot: Telegraf | null = null;
  try {
    bot = createBot();
  } catch (e) {
    console.warn('Bot disabled:', (e as Error).message);
  }

  const app = createApp({ storage, auth, bot, limiter });

  // Bot webhook or polling lifecycle
  if (bot && config.bot.mode === 'webhook') {
    bot.telegram.setWebhook(`${config.bot.webhookUrl}`);
    app.use('/telegram/webhook', (req, res) => {
      (bot as Telegraf).handleUpdate(req.body);
      res.sendStatus(200);
    });
  } else if (bot) {
    (bot as Telegraf).launch()
      .then(() => console.log('Bot started in polling mode'))
      .catch((err) => console.warn('Bot failed to start (Telegram unreachable):', err.message));
  }

  app.listen(config.port, () => {
    console.log(`Auth server running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
