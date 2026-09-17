import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]', {
    message: err?.message,
    status: err?.status || err?.statusCode || 500,
    path: req?.originalUrl,
    method: req?.method,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });

  const status = err.status || err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred while processing your request.';

  // Strip internal SQLite / filesystem absolute paths from client-facing messages
  if (typeof message === 'string') {
    message = message.replace(/\/home\/[^\s:]+/g, '[system_path]').replace(/\/Users\/[^\s:]+/g, '[system_path]');
  }

  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred. Please try again later.' 
      : message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
