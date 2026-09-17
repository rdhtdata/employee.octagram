import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();

// GET /api/users - List team members
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        department: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            assignedTasks: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
            assignedLeads: { where: { crmStatus: { notIn: ['WON', 'LOST'] } } },
            managedClients: { where: { status: 'ACTIVE' } },
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members.' });
  }
});

// GET /api/users/:id - User details & workload
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        department: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        assignedTasks: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          orderBy: { deadline: 'asc' },
          take: 10,
          include: { client: { select: { id: true, name: true } }, lead: { select: { id: true, businessName: true } } }
        },
        managedClients: {
          select: { id: true, name: true, industry: true, status: true },
          take: 10,
        },
        assignedLeads: {
          where: { crmStatus: { notIn: ['WON', 'LOST'] } },
          select: { id: true, businessName: true, crmStatus: true, leadScore: true, nextFollowUpDate: true },
          take: 10,
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// POST /api/users - Admin: Create new user
router.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, phone, department } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        role: role === 'ADMIN' ? 'ADMIN' : 'SALES',
        phone: phone?.trim() || null,
        department: department?.trim() || null,
        isActive: true,
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'CREATE',
      entityType: 'USER',
      entityId: newUser.id,
      details: { name: newUser.name, email: newUser.email, role: newUser.role }
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PATCH /api/users/:id - Update user details / role / active state
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const isSelf = req.user!.userId === id;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
      res.status(403).json({ error: 'Forbidden. You can only update your own profile.' });
      return;
    }

    const { email, name, phone, department, avatarUrl, role, isActive, password } = req.body;

    const dataToUpdate: any = {};
    if (email !== undefined && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id }
        }
      });
      if (existing) {
        res.status(400).json({ error: 'Another user account already uses this email address.' });
        return;
      }
      dataToUpdate.email = normalizedEmail;
    }

    if (name !== undefined) dataToUpdate.name = name.trim();
    if (phone !== undefined) dataToUpdate.phone = phone ? phone.trim() : null;
    if (department !== undefined) dataToUpdate.department = department ? department.trim() : null;
    if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl;

    // Only Admin can change roles and active status
    if (isAdmin) {
      if (role !== undefined) dataToUpdate.role = role === 'ADMIN' ? 'ADMIN' : 'SALES';
      if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    }

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        department: true,
        avatarUrl: true,
        isActive: true,
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: updated.id,
      details: dataToUpdate
    });

    res.json({ user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

export default router;
