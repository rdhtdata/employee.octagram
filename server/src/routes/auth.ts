import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest, TokenPayload } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'octagram-operations-hub-secure-jwt-secret-key-2026';

import { LoginRateLimiter } from '../services/loginRateLimiter.js';

// POST /api/auth/login
router.post('/login', async (req, res): Promise<void> => {
  console.log('🔑 [AUTH] POST /api/auth/login received:', {
    hasBody: !!req.body,
    email: req.body?.email,
  });

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      console.warn('⚠️ [AUTH] Missing email or password');
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const input = String(email).toLowerCase().trim();
    const candidateEmail = input.includes('@') ? input : `${input}@octagramai.com`;

    // 1. Check brute-force lockout status
    const lockout = LoginRateLimiter.checkLockout(candidateEmail, req.ip);
    if (lockout.isLocked) {
      const mins = Math.floor(lockout.remainingSeconds / 60);
      const secs = lockout.remainingSeconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      console.warn(`⛔ [AUTH] Account locked out: "${candidateEmail}" (${timeStr} remaining)`);
      res.status(429).json({
        error: `Too many failed login attempts. For security, your account is temporarily locked for 5 minutes. Please retry in ${timeStr} or contact Harsh.`,
        remainingSeconds: lockout.remainingSeconds,
        isLocked: true,
      });
      return;
    }

    console.log(`🔍 [AUTH] Searching for user: "${input}" or "${candidateEmail}"`);
    const startTime = Date.now();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: candidateEmail },
          { email: input },
        ]
      }
    });
    console.log(`⏱️ [AUTH] User search completed in ${Date.now() - startTime}ms. Found: ${!!user}`);

    if (!user) {
      const fail = LoginRateLimiter.recordFailure(candidateEmail, req.ip);
      console.warn(`⚠️ [AUTH] User not found for: "${input}" / "${candidateEmail}" (Attempt registered)`);
      if (fail.isLocked) {
        res.status(429).json({
          error: 'Too many failed login attempts. For security, your account has been locked for 5 minutes. Please contact Harsh if you need assistance.',
          remainingSeconds: fail.remainingSeconds,
          isLocked: true,
        });
        return;
      }
      res.status(401).json({
        error: `Invalid email or password. (${fail.remainingAttempts} attempt(s) remaining before 5-minute lockout)`,
        remainingAttempts: fail.remainingAttempts,
      });
      return;
    }

    if (!user.isActive) {
      console.warn(`⚠️ [AUTH] User account is inactive: "${user.email}"`);
      res.status(401).json({ error: 'User account is inactive. Please contact your administrator.' });
      return;
    }

    console.log(`🔐 [AUTH] Comparing password for user "${user.email}"...`);
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      const fail = LoginRateLimiter.recordFailure(candidateEmail, req.ip);
      console.warn(`⚠️ [AUTH] Password mismatch for user "${user.email}". (${fail.remainingAttempts} attempts left)`);
      if (fail.isLocked) {
        res.status(429).json({
          error: 'Too many failed login attempts. For security, your account has been locked for 5 minutes. Please contact Harsh if you need immediate assistance.',
          remainingSeconds: fail.remainingSeconds,
          isLocked: true,
        });
        return;
      }
      res.status(401).json({
        error: `Invalid email or password. (${fail.remainingAttempts} attempt(s) remaining before 5-minute lockout)`,
        remainingAttempts: fail.remainingAttempts,
      });
      return;
    }

    // Clear failed attempts on successful login
    LoginRateLimiter.recordSuccess(candidateEmail, req.ip);
    console.log(`✅ [AUTH] Password verified successfully for "${user.email}" (${user.role})`);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'SALES',
      name: user.name,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Non-blocking background audit log
    logActivity({
      userId: user.id,
      action: 'STATUS_CHANGE',
      entityType: 'USER',
      entityId: user.id,
      details: { action: 'USER_LOGIN', ip: req.ip }
    }).catch(logErr => console.warn('Audit logging non-fatal error:', logErr));

    console.log(`🚀 [AUTH] Login successful! Returning token for "${user.email}"`);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        department: user.department,
        avatarUrl: user.avatarUrl,
      }
    });
  } catch (error: any) {
    console.error('❌ [AUTH] Login exception caught:', error);
    res.status(500).json({ error: error?.message || 'Authentication failed. Please try again later.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        department: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User account is inactive or not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve session profile.' });
  }
});

import { passwordResetLimiter } from '../middleware/security.js';

// POST /api/auth/reset-password
router.post('/reset-password', requireAuth, passwordResetLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ error: 'Current password does not match.' });
        return;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, plainPassword: newPassword }
    });

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      details: { action: 'PASSWORD_RESET' }
    });

    res.json({ success: true, message: 'Password has been successfully updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// POST /api/auth/unlock - Manually unlock an account (DEV only)
router.post('/unlock', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'DEV') {
      res.status(403).json({ error: 'Forbidden. Only DEV users can manually unlock accounts.' });
      return;
    }

    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required to unlock.' });
      return;
    }

    LoginRateLimiter.unlock(email);
    console.log(`🔓 [AUTH] Account unlocked by DEV (${req.user.email}): ${email}`);
    res.json({ success: true, message: `Account ${email} has been unlocked.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlock account.' });
  }
});

export default router;
