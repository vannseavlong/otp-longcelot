import express from 'express';
import { KnexStorage } from './adapters/knexStorage.js';
import { AuthService as CoreAuth } from './core/auth.js';
import createAuthRouter from './routes/authRoutes.js';
import { asyncHandler } from './middlewares/asyncHandler.js';
import errorHandler from './middlewares/errorHandler.js';

export default function createApp(deps: { storage: KnexStorage; auth: CoreAuth; bot: any; limiter: any }) {
  const { storage, auth, bot, limiter } = deps;
  const app = express();
  app.use(express.json());

  // Mount auth routes (controllers handle validation and responses)
  app.use('/auth', createAuthRouter({ storage, auth, bot, limiter }));

  // Health
  app.get('/_health', asyncHandler(async (_req, res) => res.json({ ok: true })));

  // Error handler (last)
  app.use(errorHandler);

  return app;
}
