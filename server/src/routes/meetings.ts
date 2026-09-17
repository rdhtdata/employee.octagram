import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';

const router = Router();

// GET /api/meetings - List meetings
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { clientId, leadId, startDate, endDate, participantId } = req.query;

    const where: any = {};
    if (clientId) where.relatedClientId = clientId as string;
    if (leadId) where.relatedLeadId = leadId as string;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    if (participantId) {
      where.participants = { some: { userId: participantId as string } };
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        participants: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } }
        }
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });

    res.json({ meetings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meetings.' });
  }
});

// GET /api/meetings/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        client: { select: { id: true, name: true, phone: true, email: true } },
        lead: { select: { id: true, businessName: true, phone: true, email: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } }
        }
      }
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }

    res.json({ meeting });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meeting.' });
  }
});

// POST /api/meetings - Create meeting + optional action items
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      date,
      startTime,
      endTime,
      relatedClientId,
      relatedLeadId,
      locationOrLink,
      agenda,
      summary,
      decisions,
      participantUserIds,
      externalParticipants,
      actionItems,
    } = req.body;

    if (!title || !date || !startTime || !endTime) {
      res.status(400).json({ error: 'Title, date, start time, and end time are required.' });
      return;
    }

    const currentUserId = req.user!.userId;

    const participantsData: any[] = [];
    if (Array.isArray(participantUserIds)) {
      participantUserIds.forEach((uid: string) => {
        participantsData.push({ userId: uid });
      });
    }
    if (!participantsData.some(p => p.userId === currentUserId)) {
      participantsData.push({ userId: currentUserId });
    }

    if (Array.isArray(externalParticipants)) {
      externalParticipants.forEach((ep: { email?: string; name?: string }) => {
        participantsData.push({ externalEmail: ep.email, externalName: ep.name });
      });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: title.trim(),
        date: new Date(date),
        startTime,
        endTime,
        relatedClientId: relatedClientId || null,
        relatedLeadId: relatedLeadId || null,
        locationOrLink: locationOrLink?.trim() || null,
        agenda: agenda?.trim() || null,
        summary: summary?.trim() || null,
        decisions: decisions?.trim() || null,
        createdById: currentUserId,
        participants: {
          create: participantsData
        }
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        participants: {
          include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    if (Array.isArray(actionItems) && actionItems.length > 0) {
      for (const item of actionItems) {
        if (!item.title || !item.title.trim()) continue;
        await prisma.task.create({
          data: {
            title: item.title.trim(),
            description: `Action item from meeting "${meeting.title}"`,
            createdById: currentUserId,
            assignedUserId: item.assignedUserId || currentUserId,
            relatedClientId: relatedClientId || null,
            relatedLeadId: relatedLeadId || null,
            relatedMeetingId: meeting.id,
            priority: item.priority || 'MEDIUM',
            status: 'TODO',
            deadline: item.deadline ? new Date(item.deadline) : null,
            automatedType: 'MEETING_ACTION',
          }
        });
      }
    }

    for (const p of participantsData) {
      if (p.userId && p.userId !== currentUserId) {
        await prisma.notification.create({
          data: {
            userId: p.userId,
            type: 'MEETING_REMINDER',
            title: 'Meeting Invitation',
            message: `${req.user!.name} invited you to "${meeting.title}" on ${meeting.date.toISOString().split('T')[0]} at ${meeting.startTime}.`,
            linkUrl: `/calendar?meetingId=${meeting.id}`,
          }
        });
      }
    }

    await logActivity({
      userId: currentUserId,
      action: 'CREATE',
      entityType: 'MEETING',
      entityId: meeting.id,
      details: { title: meeting.title, date: meeting.date, client: meeting.client?.name }
    });

    res.status(201).json({ meeting });
  } catch (error) {
    console.error('Failed to create meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting.' });
  }
});

// PATCH /api/meetings/:id - Update meeting / summary / decisions / add action items
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      title,
      date,
      startTime,
      endTime,
      locationOrLink,
      agenda,
      summary,
      decisions,
      newActionItems,
    } = req.body;

    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        date: date !== undefined ? new Date(date) : undefined,
        startTime: startTime !== undefined ? startTime : undefined,
        endTime: endTime !== undefined ? endTime : undefined,
        locationOrLink: locationOrLink !== undefined ? locationOrLink?.trim() : undefined,
        agenda: agenda !== undefined ? agenda?.trim() : undefined,
        summary: summary !== undefined ? summary?.trim() : undefined,
        decisions: decisions !== undefined ? decisions?.trim() : undefined,
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        participants: {
          include: { user: { select: { id: true, name: true } } }
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } }
        }
      }
    });

    if (Array.isArray(newActionItems) && newActionItems.length > 0) {
      for (const item of newActionItems) {
        if (!item.title || !item.title.trim()) continue;
        await prisma.task.create({
          data: {
            title: item.title.trim(),
            description: `Action item from meeting "${updated.title}"`,
            createdById: req.user!.userId,
            assignedUserId: item.assignedUserId || req.user!.userId,
            relatedClientId: updated.relatedClientId,
            relatedLeadId: updated.relatedLeadId,
            relatedMeetingId: updated.id,
            priority: item.priority || 'MEDIUM',
            status: 'TODO',
            deadline: item.deadline ? new Date(item.deadline) : null,
            automatedType: 'MEETING_ACTION',
          }
        });
      }
    }

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'MEETING',
      entityId: updated.id,
      details: { title: updated.title, summaryUpdated: !!summary }
    });

    res.json({ meeting: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update meeting.' });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }

    await prisma.meeting.delete({ where: { id } });

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'MEETING',
      entityId: id,
      details: { title: meeting.title }
    });

    res.json({ success: true, message: 'Meeting deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete meeting.' });
  }
});

export default router;
