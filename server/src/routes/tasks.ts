import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();

// GET /api/tasks - List tasks with flexible filters (purely read-only)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      view, // 'my' | 'team' | 'overdue' | 'today' | 'upcoming'
      status,
      priority,
      clientId,
      leadId,
      assignedUserId,
      search,
    } = req.query;

    const currentUserId = req.user!.userId;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const where: any = {};

    // Filter by view
    if (view === 'my') {
      where.OR = [
        { assignedUserId: currentUserId },
        { collaborators: { some: { userId: currentUserId } } },
        { isPersonal: true, createdById: currentUserId }
      ];
    } else if (view === 'team') {
      where.isPersonal = false;
    } else if (view === 'overdue') {
      where.deadline = { lt: startOfToday };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    } else if (view === 'today') {
      where.deadline = { gte: startOfToday, lte: endOfToday };
    } else if (view === 'upcoming') {
      where.deadline = { gt: endOfToday };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (priority && typeof priority === 'string' && priority !== 'ALL') {
      where.priority = priority;
    }

    if (clientId) where.relatedClientId = clientId;
    if (leadId) where.relatedLeadId = leadId;
    if (assignedUserId) where.assignedUserId = assignedUserId;

    if (search && typeof search === 'string' && search.trim()) {
      where.title = { contains: search.trim() };
    }

    const isSales = req.user!.role === 'SALES';
    if (isSales) {
      where.relatedClientId = null;
      where.automatedType = null;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        meeting: { select: { id: true, title: true } },
        ticket: { select: { id: true, ticketNumber: true, title: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
        },
        _count: { select: { comments: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { deadline: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    let results = tasks;
    if (isSales) {
      results = tasks.filter(t => {
        if (t.relatedClientId || t.client) return false;
        if (t.automatedType === 'PAYMENT_REMINDER' || t.automatedType === 'EXPENSE_REMINDER') return false;
        const text = ((t.title || '') + ' ' + (t.description || '')).toLowerCase();
        if (text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) return false;
        return true;
      });
    }

    res.json({ tasks: results });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// GET /api/tasks/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, phone: true, email: true } },
        lead: { select: { id: true, businessName: true, phone: true, email: true } },
        meeting: { select: { id: true, title: true, date: true } },
        ticket: { select: { id: true, ticketNumber: true, title: true, priority: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
        },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        },
        documents: true,
      }
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (req.user!.role === 'SALES') {
      const text = ((task.title || '') + ' ' + (task.description || '')).toLowerCase();
      if (task.relatedClientId || task.client || task.automatedType === 'PAYMENT_REMINDER' || task.automatedType === 'EXPENSE_REMINDER' || text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) {
        res.status(403).json({ error: 'Access restricted: Sales representatives cannot access client or financial tasks.' });
        return;
      }
    }

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task details.' });
  }
});

// POST /api/tasks - Create task
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      assignedUserId,
      relatedClientId,
      relatedLeadId,
      relatedMeetingId,
      relatedTicketId,
      priority,
      status,
      deadline,
      recurrence,
      isPersonal,
      collaboratorIds,
      audienceMode, // 'ASSIGNEE_ONLY' | 'ALL' | 'SELECTED'
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }

    const currentUserId = req.user!.userId;
    const isSales = req.user!.role === 'SALES';
    const assignee = isPersonal ? currentUserId : (assignedUserId || currentUserId);
    const targetClientId = isSales ? null : (relatedClientId || null);

    let finalCollaboratorIds: string[] = [];
    if (audienceMode === 'ALL') {
      const allUsers = await prisma.user.findMany({
        where: { isActive: true, id: { not: currentUserId } },
        select: { id: true }
      });
      finalCollaboratorIds = allUsers.map(u => u.id).filter(id => id !== assignee);
    } else if (Array.isArray(collaboratorIds)) {
      finalCollaboratorIds = collaboratorIds.filter((id: string) => id !== assignee && id !== currentUserId);
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        createdById: currentUserId,
        assignedUserId: assignee,
        relatedClientId: targetClientId,
        relatedLeadId: relatedLeadId || null,
        relatedMeetingId: relatedMeetingId || null,
        relatedTicketId: relatedTicketId || null,
        priority: priority || 'MEDIUM',
        status: status || 'TODO',
        deadline: deadline ? new Date(deadline) : null,
        recurrence: recurrence || 'NONE',
        isPersonal: Boolean(isPersonal),
        collaborators: finalCollaboratorIds.length > 0
          ? {
              create: finalCollaboratorIds.map((uid: string) => ({ userId: uid }))
            }
          : undefined
      },
      include: {
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
        }
      }
    });

    // Notify assignee if assigned to someone else
    if (assignee && assignee !== currentUserId) {
      await prisma.notification.create({
        data: {
          userId: assignee,
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `${req.user!.name} assigned you the task "${task.title}".`,
          linkUrl: `/tasks?taskId=${task.id}`,
        }
      });
    }

    // Notify collaborators
    for (const collabId of finalCollaboratorIds) {
      if (collabId !== currentUserId && collabId !== assignee) {
        await prisma.notification.create({
          data: {
            userId: collabId,
            type: 'TASK_ASSIGNED',
            title: 'Shared Team Task',
            message: `${req.user!.name} included you on the team task "${task.title}".`,
            linkUrl: `/tasks?taskId=${task.id}`,
          }
        });
      }
    }

    // Log Activity
    await logActivity({
      userId: currentUserId,
      action: 'CREATE',
      entityType: 'TASK',
      entityId: task.id,
      details: { title: task.title, assignedTo: assignee, priority: task.priority }
    });

    res.status(201).json({ task });
  } catch (error) {
    console.error('Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// PATCH /api/tasks/:id - Update task / status / priority / snooze deadline
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      title,
      description,
      assignedUserId,
      relatedClientId,
      relatedLeadId,
      priority,
      status,
      deadline,
      recurrence,
      collaboratorIds,
    } = req.body;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (req.user!.role === 'SALES') {
      const text = ((existing.title || '') + ' ' + (existing.description || '')).toLowerCase();
      if (existing.relatedClientId || existing.automatedType === 'PAYMENT_REMINDER' || existing.automatedType === 'EXPENSE_REMINDER' || text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) {
        res.status(403).json({ error: 'Access restricted: Sales representatives cannot modify client or financial tasks.' });
        return;
      }
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (assignedUserId !== undefined) updateData.assignedUserId = assignedUserId || null;
    if (relatedClientId !== undefined) updateData.relatedClientId = relatedClientId || null;
    if (relatedLeadId !== undefined) updateData.relatedLeadId = relatedLeadId || null;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
    if (recurrence !== undefined) updateData.recurrence = recurrence;

    if (Array.isArray(collaboratorIds)) {
      await prisma.taskCollaborator.deleteMany({ where: { taskId: id } });
      if (collaboratorIds.length > 0) {
        updateData.collaborators = {
          create: collaboratorIds.map((uid: string) => ({ userId: uid }))
        };
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    // Notify if reassigned
    if (assignedUserId && assignedUserId !== existing.assignedUserId && assignedUserId !== req.user!.userId) {
      await prisma.notification.create({
        data: {
          userId: assignedUserId,
          type: 'TASK_ASSIGNED',
          title: 'Task Reassigned to You',
          message: `${req.user!.name} assigned you the task "${updatedTask.title}".`,
          linkUrl: `/tasks?taskId=${updatedTask.id}`,
        }
      });
    }

    await logActivity({
      userId: req.user!.userId,
      action: status === 'COMPLETED' ? 'TASK_COMPLETED' : 'UPDATE',
      entityType: 'TASK',
      entityId: updatedTask.id,
      details: { title: updatedTask.title, status: updatedTask.status, priority: updatedTask.priority }
    });

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Failed to update task:', error);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (req.user!.role === 'SALES') {
      const text = ((task.title || '') + ' ' + (task.description || '')).toLowerCase();
      if (task.relatedClientId || task.automatedType === 'PAYMENT_REMINDER' || task.automatedType === 'EXPENSE_REMINDER' || text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) {
        res.status(403).json({ error: 'Access restricted: Sales representatives cannot delete client or financial tasks.' });
        return;
      }
    }

    await prisma.task.delete({ where: { id } });

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'TASK',
      entityId: id,
      details: { title: task.title }
    });

    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (req.user!.role === 'SALES') {
      const text = ((task.title || '') + ' ' + (task.description || '')).toLowerCase();
      if (task.relatedClientId || task.automatedType === 'PAYMENT_REMINDER' || task.automatedType === 'EXPENSE_REMINDER' || text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) {
        res.status(403).json({ error: 'Access restricted: Sales representatives cannot comment on client or financial tasks.' });
        return;
      }
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content is required.' });
      return;
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: req.user!.userId,
        content: content.trim()
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // Detect @mentions
    const mentionMatches = content.match(/@(\w+)/g);
    if (mentionMatches) {
      const names = mentionMatches.map((m: string) => m.slice(1).toLowerCase());
      const mentionedUsers = await prisma.user.findMany({
        where: {
          OR: names.map((name: string) => ({
            name: { contains: name }
          }))
        }
      });

      for (const u of mentionedUsers) {
        if (u.id !== req.user!.userId) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              type: 'MENTION',
              title: 'Mentioned in Task Comment',
              message: `${req.user!.name} mentioned you on a task: "${content.slice(0, 80)}"`,
              linkUrl: `/tasks?taskId=${id}`,
            }
          });
        }
      }
    }

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

export default router;
