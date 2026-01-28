import express from 'express';
import { createAuthController } from '../controllers/authController.js';
import { KnexStorage } from '../adapters/knexStorage.js';
import { AuthService as CoreAuth } from '../core/auth.js';
import { AuthService as ServiceAuth } from '../services/authService.js';
import { Telegraf } from 'telegraf';

export default function createAuthRouter(deps: { storage: KnexStorage; auth: CoreAuth | ServiceAuth; bot: Telegraf | null; limiter: any }) {
	const router = express.Router();
	const serviceAuth = deps.auth instanceof ServiceAuth ? deps.auth : new ServiceAuth(deps.storage, deps.bot, deps.limiter);
	const controller = createAuthController({ storage: deps.storage, auth: serviceAuth, bot: deps.bot, limiter: deps.limiter });

	router.post('/register', controller.register);
	router.post('/login', controller.login);
	router.post('/login/verify-otp', controller.verifyOtp);
	router.post('/otp/initiate', controller.otpInitiate);
	router.post('/telegram/link/initiate', controller.initiateLink);
	router.post('/telegram/change/initiate', controller.changeInitiate);
	router.post('/telegram/change/confirm', controller.changeConfirm);
	router.post('/telegram/recover/verify', controller.recoverVerify);

	return router;
}
