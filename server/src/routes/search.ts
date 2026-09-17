import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

export interface SearchResultItem {
  id: string;
  type: 'CLIENT' | 'LEAD' | 'TASK' | 'MEETING' | 'TICKET' | 'EMPLOYEE';
  title: string;
  subtitle: string;
  url: string;
  badge?: string;
  priority?: string;
}

// GET /api/search?q=...
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'DEV';
    const currentUserId = req.user!.userId;
    const results: SearchResultItem[] = [];

    // 1. Search Clients
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { industry: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ]
      },
      take: 6
    });

    clients.forEach(c => {
      results.push({
        id: c.id,
        type: 'CLIENT',
        title: c.name,
        subtitle: `${c.industry || 'Client'} • ${c.status}`,
        url: `/clients/${c.id}`,
        badge: c.status,
      });
    });

    // 2. Search Leads
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { businessName: { contains: q } },
          { contactName: { contains: q } },
          { category: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ]
      },
      take: 6
    });

    leads.forEach(l => {
      results.push({
        id: l.id,
        type: 'LEAD',
        title: l.businessName,
        subtitle: `${l.category || 'Lead'} • Stage: ${l.crmStatus} • Score: ${l.leadScore || 50}`,
        url: `/crm/leads/${l.id}`,
        badge: l.crmStatus,
      });
    });

    // 3. Search Tasks
    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          isAdmin ? {} : {
            OR: [
              { isPersonal: false },
              { createdById: currentUserId },
              { assignedUserId: currentUserId }
            ]
          },
          {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
            ]
          }
        ]
      },
      include: {
        client: { select: { name: true } },
        lead: { select: { businessName: true } }
      },
      take: 6
    });

    tasks.forEach(t => {
      results.push({
        id: t.id,
        type: 'TASK',
        title: t.title,
        subtitle: t.client ? `Client: ${t.client.name}` : t.lead ? `Lead: ${t.lead.businessName}` : `Status: ${t.status}`,
        url: `/tasks?taskId=${t.id}`,
        badge: t.status,
        priority: t.priority,
      });
    });

    // 4. Search Meetings
    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { summary: { contains: q } },
          { agenda: { contains: q } },
        ]
      },
      include: { client: { select: { name: true } } },
      take: 5
    });

    meetings.forEach(m => {
      results.push({
        id: m.id,
        type: 'MEETING',
        title: m.title,
        subtitle: `${m.date.toISOString().split('T')[0]} • ${m.startTime} ${m.client ? `• ${m.client.name}` : ''}`,
        url: `/calendar?meetingId=${m.id}`,
      });
    });

    // 5. Search Tickets
    const tickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ]
      },
      take: 5
    });

    tickets.forEach(t => {
      results.push({
        id: t.id,
        type: 'TICKET',
        title: `#${t.ticketNumber} ${t.title}`,
        subtitle: `Priority: ${t.priority} • Status: ${t.status}`,
        url: `/tickets?ticketId=${t.id}`,
        badge: t.status,
        priority: t.priority,
      });
    });

    // 6. Search Employees
    const employees = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { department: { contains: q } },
        ]
      },
      take: 4
    });

    employees.forEach(e => {
      results.push({
        id: e.id,
        type: 'EMPLOYEE',
        title: e.name,
        subtitle: `${e.role} • ${e.department || 'Operations'}`,
        url: `/team?userId=${e.id}`,
        badge: e.role,
      });
    });

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search.' });
  }
});

export default router;
