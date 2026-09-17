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
    const isDev = req.user!.role === 'DEV';
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
        plainPassword: isDev,
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
    const isDev = req.user!.role === 'DEV';
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
        plainPassword: isDev,
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

// POST /api/users - Admin/Dev: Create new user
router.post('/', requireAuth, requireRole(['ADMIN', 'DEV']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    let assignedRole: 'DEV' | 'ADMIN' | 'SALES' = 'SALES';
    if (role === 'DEV' && req.user!.role === 'DEV') {
      assignedRole = 'DEV';
    } else if (role === 'ADMIN' || role === 'DEV') {
      assignedRole = 'ADMIN';
    }

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        plainPassword: String(password),
        name: name.trim(),
        role: assignedRole,
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
        plainPassword: req.user!.role === 'DEV' ? newUser.plainPassword : undefined,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PATCH /api/users/:id - Update user details / role / active state / password
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const isSelf = req.user!.userId === id;
    const isDev = req.user!.role === 'DEV';
    const isAdmin = req.user!.role === 'ADMIN' || isDev;

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

    // Only Admin/Dev can change roles and active status
    if (isAdmin) {
      if (role !== undefined) {
        if (role === 'DEV' && isDev) {
          dataToUpdate.role = 'DEV';
        } else if (role === 'ADMIN') {
          dataToUpdate.role = 'ADMIN';
        } else {
          dataToUpdate.role = 'SALES';
        }
      }
      if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    }

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.passwordHash = await bcrypt.hash(password, salt);
      dataToUpdate.plainPassword = String(password);
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
        plainPassword: isDev,
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: updated.id,
      details: { ...dataToUpdate, passwordHash: undefined }
    });

    res.json({ user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// DELETE /api/users/:id - Delete user (DEV only)
router.delete('/:id', requireAuth, requireRole('DEV'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (req.user!.userId === id) {
      res.status(400).json({ error: 'You cannot delete your own active account.' });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    // Safely uncouple references before deleting
    await prisma.$transaction([
      prisma.client.updateMany({ where: { accountManagerId: id }, data: { accountManagerId: null } }),
      prisma.lead.updateMany({ where: { assignedUserId: id }, data: { assignedUserId: null } }),
      prisma.task.updateMany({ where: { assignedUserId: id }, data: { assignedUserId: null } }),
      prisma.ticket.updateMany({ where: { assignedUserId: id }, data: { assignedUserId: null } }),
      prisma.payment.updateMany({ where: { responsibleUserId: id }, data: { responsibleUserId: null } }),
      prisma.expense.updateMany({ where: { responsibleUserId: id }, data: { responsibleUserId: null } }),
      prisma.taskCollaborator.deleteMany({ where: { userId: id } }),
      prisma.ticketCollaborator.deleteMany({ where: { userId: id } }),
      prisma.meetingParticipant.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'USER',
      entityId: id,
      details: { deletedEmail: targetUser.email, deletedName: targetUser.name, deletedRole: targetUser.role }
    });

    res.json({ success: true, message: `Account ${targetUser.name} (${targetUser.email}) was successfully deleted.` });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: error?.message || 'Failed to delete user.' });
  }
});

export default router;
