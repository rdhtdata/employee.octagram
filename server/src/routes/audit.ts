import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// GET /api/audit - List audit logs (Admin only)
router.get('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { entityType, action, userId, limit, offset } = req.query;

    const where: any = {};
    if (entityType && entityType !== 'ALL') where.entityType = entityType as string;
    if (action && action !== 'ALL') where.action = action as string;
    if (userId) where.userId = userId as string;

    const take = limit ? Math.min(Number(limit), 100) : 50;
    const skip = offset ? Number(offset) : 0;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.activityLog.count({ where })
    ]);

    res.json({ logs, total, limit: take, offset: skip });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

export default router;
