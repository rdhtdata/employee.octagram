import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest, TokenPayload } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'octagram-operations-hub-secure-jwt-secret-key-2026';

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

    console.log(`🔍 [AUTH] Searching for user: "${input}" or "${candidateEmail}"`);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: candidateEmail },
          { email: input },
        ]
      }
    });

    if (!user) {
      console.warn(`⚠️ [AUTH] User not found for: "${input}" / "${candidateEmail}"`);
      res.status(401).json({ error: 'Invalid email or password. Please try again.' });
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
      console.warn(`⚠️ [AUTH] Password mismatch for user "${user.email}"`);
      res.status(401).json({ error: 'Invalid email or password. Please try again.' });
      return;
    }

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

// POST /api/auth/reset-password
router.post('/reset-password', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      data: { passwordHash }
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

export default router;
