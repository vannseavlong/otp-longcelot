import express from 'express';
import createApp from '../../dist/app.js';
import { KnexStorage } from '../../dist/adapters/knexStorage.js';
import { AuthService } from '../../dist/services/authService.js';
import { createBot } from '../../dist/telegram/bot.js';

async function main() {
  // Ensure the main project is built (dist/) before running this example.
  const storage = new KnexStorage();
  let bot = null;
  try {
    bot = createBot();
  } catch (e) {
    console.warn('Bot disabled in example:', (e && e.message) || e);
  }
  const auth = new AuthService(storage, bot, null);

  const app = express();
  app.use(express.json());
  app.use('/auth', createApp({ storage, auth, bot, limiter: null }));

  const port = process.env.EXAMPLE_PORT || 4000;
  app.listen(port, () => console.log(`Embedded example listening on ${port}`));
}

main().catch((err) => {
  console.error('Failed to start example:', err);
  process.exit(1);
});
