import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../config.js';

// Single shared in-memory rate limiter used by routes that need it.
export const limiter = new RateLimiterMemory({
  points: config.rateLimit.max,
  duration: Math.max(1, Math.floor(config.rateLimit.windowMs / 1000))
});

// Convenience middleware to guard requests (optional use)
export function rateLimitMiddleware() {
  return async (req: any, res: any, next: any) => {
    try {
      await limiter.consume((req.ip as string) || 'unknown');
      next();
    } catch (_) {
      res.status(429).json({ error: 'Too many requests' });
    }
  };
}
