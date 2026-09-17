import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();

// GET /api/tickets - List tickets with filters
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, category, priority, assignedUserId, clientId, search } = req.query;

    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (category && typeof category === 'string' && category !== 'ALL') {
      where.category = category;
    }
    if (priority && typeof priority === 'string' && priority !== 'ALL') {
      where.priority = priority;
    }
    if (assignedUserId) where.assignedUserId = assignedUserId as string;
    if (clientId) where.relatedClientId = clientId as string;

    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        _count: { select: { comments: true } }
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

// GET /api/tickets/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, phone: true, email: true } },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } }
        }
      }
    });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    res.json({ ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// POST /api/tickets - Create ticket
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, priority, status, relatedClientId, assignedUserId, deadline } = req.body;

    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required.' });
      return;
    }

    // Determine next ticket number
    const lastTicket = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' }
    });
    const nextNumber = lastTicket ? lastTicket.ticketNumber + 1 : 1001;

    const currentUserId = req.user!.userId;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: nextNumber,
        title: title.trim(),
        description: description.trim(),
        category: category || 'CLIENT',
        priority: priority || 'MEDIUM',
        status: status || 'OPEN',
        relatedClientId: relatedClientId || null,
        assignedUserId: assignedUserId || null,
        createdById: currentUserId,
        deadline: deadline ? new Date(deadline) : null,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } }
      }
    });

    if (assignedUserId && assignedUserId !== currentUserId) {
      await prisma.notification.create({
        data: {
          userId: assignedUserId,
          type: 'TICKET_UPDATE',
          title: `Assigned Ticket #${ticket.ticketNumber}`,
          message: `${req.user!.name} assigned you ticket #${ticket.ticketNumber}: "${ticket.title}".`,
          linkUrl: `/tickets?ticketId=${ticket.id}`,
        }
      });
    }

    await logActivity({
      userId: currentUserId,
      action: 'CREATE',
      entityType: 'TICKET',
      entityId: ticket.id,
      details: { ticketNumber: ticket.ticketNumber, title: ticket.title, priority: ticket.priority }
    });

    res.status(201).json({ ticket });
  } catch (error) {
    console.error('Failed to create ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket.' });
  }
});

// PATCH /api/tickets/:id - Update status / assignee / priority
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, category, priority, status, assignedUserId, deadline } = req.body;

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        category: category !== undefined ? category : undefined,
        priority: priority !== undefined ? priority : undefined,
        status: status !== undefined ? status : undefined,
        assignedUserId: assignedUserId !== undefined ? (assignedUserId || null) : undefined,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } }
      }
    });

    if (assignedUserId && assignedUserId !== existing.assignedUserId && assignedUserId !== req.user!.userId) {
      await prisma.notification.create({
        data: {
          userId: assignedUserId,
          type: 'TICKET_UPDATE',
          title: `Ticket Reassigned: #${updated.ticketNumber}`,
          message: `${req.user!.name} assigned you ticket #${updated.ticketNumber}: "${updated.title}".`,
          linkUrl: `/tickets?ticketId=${updated.id}`,
        }
      });
    }

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'TICKET',
      entityId: updated.id,
      details: { ticketNumber: updated.ticketNumber, status: updated.status, priority: updated.priority }
    });

    res.json({ ticket: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket.' });
  }
});

// POST /api/tickets/:id/comments
router.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content is required.' });
      return;
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: req.user!.userId,
        content: content.trim(),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post ticket comment.' });
  }
});

export default router;
