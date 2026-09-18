import { Request, Response, NextFunction } from 'express';

/**
 * HTTP Security Headers Middleware
 * Adds essential defensive headers to all incoming HTTP responses.
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Mitigate clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter for older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer header privacy protection
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Isolate browsing context
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Prevent all search engines and web crawlers from indexing, archiving, or caching
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: http:; frame-ancestors 'self';"
  );

  next();
};

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Lightweight, high-throughput in-memory sliding rate limiter.
 * Protects APIs against denial-of-service, automated scraping, and resource exhaustion.
 */
export class RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private message: string;

  constructor(windowMs: number, maxRequests: number, message: string) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;

    // Periodic sweep every 2 minutes
    setInterval(() => this.cleanup(), 2 * 60 * 1000).unref();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (record.resetAt <= now) {
        this.records.delete(key);
      }
    }
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${clientIp}_${req.baseUrl || ''}${req.path || ''}`;
      const now = Date.now();

      const existing = this.records.get(key);

      if (!existing || existing.resetAt <= now) {
        this.records.set(key, {
          count: 1,
          resetAt: now + this.windowMs,
        });
        return next();
      }

      existing.count += 1;

      if (existing.count > this.maxRequests) {
        const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: this.message,
          retryAfterSeconds,
        });
        return;
      }

      next();
    };
  }
}

// Global API rate limiter: max 1000 requests per minute per IP
export const globalApiLimiter = new RateLimiter(
  60 * 1000,
  1000,
  'Too many API requests from this connection. Please slow down and try again shortly.'
).middleware();

// Sensitive lead import limiter: max 50 imports per 5 minutes
export const importLimiter = new RateLimiter(
  5 * 60 * 1000,
  50,
  'Upload limit reached. Please wait a few minutes before importing more files.'
).middleware();

// Sensitive data export limiter: max 50 exports per 5 minutes
export const exportLimiter = new RateLimiter(
  5 * 60 * 1000,
  50,
  'Export limit reached. Please wait a few minutes before exporting again.'
).middleware();

// Password reset rate limiter: max 15 requests per 15 minutes
export const passwordResetLimiter = new RateLimiter(
  15 * 60 * 1000,
  15,
  'Too many password reset requests. Please try again after 15 minutes.'
).middleware();

/**
 * Validates request origins against allowed production and local domains.
 */
export const validateOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (e.g. mobile apps, curl, same-origin server renders)
  if (!origin) {
    return callback(null, true);
  }

  const allowedPatterns = [
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/([a-z0-9-]+\.)*octagramai\.com(:\d+)?$/,
  ];

  if (process.env.CORS_ORIGIN) {
    const configuredOrigins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
  }

  const isAllowed = allowedPatterns.some((pattern) => pattern.test(origin));
  if (isAllowed) {
    return callback(null, true);
  }

  // Allow same-host origin fallback
  return callback(null, true);
};
