import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, TokenPayload, UserRole } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'octagram-operations-hub-secure-jwt-secret-key-2026';

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
};

export const requireRole = (allowedRoles: UserRole | UserRole[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    // DEV users have universal bypass for all role checks
    if (req.user.role === 'DEV' || roles.includes(req.user.role)) {
      return next();
    }

    res.status(403).json({
      error: 'Access restricted. You do not have administrative permissions to view or modify this resource.',
      code: 'FORBIDDEN_ROLE'
    });
  };
};
