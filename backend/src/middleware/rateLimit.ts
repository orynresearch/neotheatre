import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const downloadRateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Download rate limiter middleware.
 * Restricts client to `maxRequests` per `windowSeconds`.
 * Keyed by user ID (if available) or client IP.
 */
export function downloadRateLimiter(windowSeconds: number = 10, maxRequests: number = 1) {
  const windowMs = windowSeconds * 1000;

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    const clientId = user?.sub || user?.id || req.ip || req.socket.remoteAddress || 'anonymous';
    const now = Date.now();

    const record = downloadRateLimitStore.get(clientId);

    if (!record || now >= record.resetTime) {
      // New window
      const resetTime = now + windowMs;
      downloadRateLimitStore.set(clientId, {
        count: 1,
        resetTime,
      });

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
      return next();
    }

    // Existing window
    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Download rate limit exceeded. Please wait ${retryAfterSeconds} seconds before requesting another download.`,
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    // Increment inside window
    record.count += 1;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    return next();
  };
}
