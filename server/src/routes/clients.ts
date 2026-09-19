import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();

// GET /api/clients - Client list
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, status, industry, accountManagerId } = req.query;

    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (industry && typeof industry === 'string' && industry !== 'ALL') {
      where.industry = industry;
    }
    if (accountManagerId) {
      where.accountManagerId = accountManagerId as string;
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { email: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { industry: { contains: search.trim() } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        accountManager: { select: { id: true, name: true, email: true, avatarUrl: true } },
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: {
          select: {
            tasks: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
            meetings: true,
            tickets: { where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } },
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ clients });
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients.' });
  }
});

// GET /api/clients/:id - Detailed client workspace
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Sales users are restricted from detailed client account workspaces
    if (req.user!.role === 'SALES') {
      res.status(403).json({ error: 'Access restricted: Sales representatives can view the client directory but cannot access individual client accounts.' });
      return;
    }

    const id = req.params.id as string;
    const isAdmin = req.user!.role === 'ADMIN';

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        accountManager: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        convertedLead: { select: { id: true, businessName: true, leadScore: true, rating: true, totalReviews: true, googleMapsUrl: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }]
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: [{ status: 'asc' }, { deadline: 'asc' }]
        },
        meetings: {
          include: {
            creator: { select: { id: true, name: true } },
            participants: { include: { user: { select: { id: true, name: true } } } }
          },
          orderBy: { date: 'desc' }
        },
        communications: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { occurredAt: 'desc' }
        },
        tickets: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        payments: {
          include: { responsibleUser: { select: { id: true, name: true } } },
          orderBy: { dueDate: 'asc' }
        },
        expenses: {
          include: { responsibleUser: { select: { id: true, name: true } } },
          orderBy: { dueDate: 'asc' }
        },
        documents: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }

    // Fetch activity logs for this client
    const activities = await prisma.activityLog.findMany({
      where: {
        OR: [
          { entityId: id },
          { details: { contains: client.name } }
        ]
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({ client: { ...client, activities } });
  } catch (error) {
    console.error('Failed to fetch client workspace:', error);
    res.status(500).json({ error: 'Failed to fetch client workspace.' });
  }
});

// POST /api/clients - Create client
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, industry, website, phone, email, address, status, accountManagerId, contactName, contactPhone, contactEmail } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Client name is required.' });
      return;
    }

    let targetManagerId: string | null = null;
    if (accountManagerId === 'UNASSIGNED') {
      targetManagerId = null;
    } else if (accountManagerId && typeof accountManagerId === 'string' && accountManagerId.trim()) {
      targetManagerId = accountManagerId.trim();
    } else if (accountManagerId === undefined) {
      targetManagerId = req.user!.userId;
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        industry: industry?.trim() || null,
        website: website?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        status: status || 'ACTIVE',
        accountManagerId: targetManagerId,
        contacts: contactName ? {
          create: {
            name: contactName.trim(),
            phone: contactPhone?.trim() || null,
            email: contactEmail?.trim() || null,
            isPrimary: true,
          }
        } : undefined
      },
      include: {
        accountManager: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        contacts: true
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'CREATE',
      entityType: 'CLIENT',
      entityId: client.id,
      details: { name: client.name, industry: client.industry, accountManager: client.accountManager?.name || 'Unassigned' }
    });

    res.status(201).json({ client });
  } catch (error) {
    console.error('Failed to create client:', error);
    res.status(500).json({ error: 'Failed to create client.' });
  }
});

// PATCH /api/clients/:id - Update client
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role === 'SALES') {
      res.status(403).json({ error: 'Sales representatives cannot modify client accounts.' });
      return;
    }

    const id = req.params.id as string;
    const { name, industry, website, phone, email, address, status, accountManagerId } = req.body;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }

    let parsedManagerId: string | null | undefined = undefined;
    if (accountManagerId !== undefined) {
      if (accountManagerId === 'UNASSIGNED' || accountManagerId === '' || accountManagerId === null) {
        parsedManagerId = null;
      } else {
        parsedManagerId = typeof accountManagerId === 'string' ? accountManagerId.trim() : null;
      }
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        industry: industry !== undefined ? industry?.trim() : undefined,
        website: website !== undefined ? website?.trim() : undefined,
        phone: phone !== undefined ? phone?.trim() : undefined,
        email: email !== undefined ? email?.trim() : undefined,
        address: address !== undefined ? address?.trim() : undefined,
        status: status !== undefined ? status : undefined,
        accountManagerId: parsedManagerId,
      },
      include: {
        accountManager: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        contacts: true,
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'CLIENT',
      entityId: updated.id,
      details: { name: updated.name, status: updated.status, accountManager: updated.accountManager?.name || 'Unassigned' }
    });

    res.json({ client: updated });
  } catch (error) {
    console.error('Failed to update client:', error);
    res.status(500).json({ error: 'Failed to update client.' });
  }
});

// DELETE /api/clients/:id - Admin only
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }

    await prisma.client.delete({ where: { id } });

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'CLIENT',
      entityId: id,
      details: { name: client.name }
    });

    res.json({ success: true, message: 'Client deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client.' });
  }
});

// POST /api/clients/:id/contacts
router.post('/:id/contacts', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, title, email, phone, isPrimary } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Contact name is required.' });
      return;
    }

    if (isPrimary) {
      await prisma.clientContact.updateMany({
        where: { clientId: id },
        data: { isPrimary: false }
      });
    }

    const contact = await prisma.clientContact.create({
      data: {
        clientId: id,
        name: name.trim(),
        title: title?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        isPrimary: Boolean(isPrimary),
      }
    });

    res.status(201).json({ contact });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add contact.' });
  }
});

// POST /api/clients/:id/notes
router.post('/:id/notes', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { content, isPinned } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Note content is required.' });
      return;
    }

    const note = await prisma.clientNote.create({
      data: {
        clientId: id,
        authorId: req.user!.userId,
        content: content.trim(),
        isPinned: Boolean(isPinned),
      },
      include: { author: { select: { id: true, name: true } } }
    });

    res.status(201).json({ note });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note.' });
  }
});

// POST /api/clients/:id/communications
router.post('/:id/communications', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { type, subject, content, direction, occurredAt } = req.body;
    if (!type || !content) {
      res.status(400).json({ error: 'Communication type and content are required.' });
      return;
    }

    const comm = await prisma.communication.create({
      data: {
        relatedClientId: id,
        authorId: req.user!.userId,
        type,
        subject: subject?.trim() || null,
        content: content.trim(),
        direction: direction || 'OUTBOUND',
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
      include: { author: { select: { id: true, name: true } } }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'CREATE',
      entityType: 'COMMUNICATION',
      entityId: comm.id,
      details: { type, clientId: id, subject }
    });

    res.status(201).json({ communication: comm });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log communication.' });
  }
});

export default router;
