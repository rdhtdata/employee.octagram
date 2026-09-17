import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// GET /api/calendar/events - Aggregated company events feed
router.get('/events', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { start, end, userId, eventType } = req.query;
    const currentUserId = req.user!.userId;
    const isAdmin = req.user!.role === 'ADMIN';
    const isSales = req.user!.role === 'SALES';

    const startDate = start ? new Date(start as string) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const endDate = end ? new Date(end as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);

    const events: Array<{
      id: string;
      title: string;
      type: 'MEETING' | 'TASK_DEADLINE' | 'LEAD_FOLLOWUP' | 'PAYMENT_DUE' | 'EXPENSE_DUE';
      start: Date | string;
      end?: Date | string;
      allDay?: boolean;
      status?: string;
      priority?: string;
      relatedEntity?: { id: string; name: string; type: string };
      assignedUser?: { id: string; name: string };
    }> = [];

    // 1. Meetings
    if (!eventType || eventType === 'ALL' || eventType === 'MEETING') {
      const meetingsWhere: any = {
        date: { gte: startDate, lte: endDate }
      };
      if (isSales) {
        meetingsWhere.clientId = null;
      }
      if (userId) {
        meetingsWhere.participants = { some: { userId: userId as string } };
      }

      const meetings = await prisma.meeting.findMany({
        where: meetingsWhere,
        include: {
          client: { select: { id: true, name: true } },
          lead: { select: { id: true, businessName: true } },
          creator: { select: { id: true, name: true } },
        }
      });

      meetings.forEach(m => {
        const dateStr = m.date.toISOString().split('T')[0];
        const startDateTime = new Date(`${dateStr}T${m.startTime || '09:00'}:00`);
        const endDateTime = new Date(`${dateStr}T${m.endTime || '10:00'}:00`);

        events.push({
          id: `meeting-${m.id}`,
          title: m.title,
          type: 'MEETING',
          start: startDateTime,
          end: endDateTime,
          allDay: false,
          relatedEntity: m.client
            ? { id: m.client.id, name: m.client.name, type: 'CLIENT' }
            : m.lead
            ? { id: m.lead.id, name: m.lead.businessName, type: 'LEAD' }
            : undefined,
          assignedUser: m.creator,
        });
      });
    }

    // 2. Task Deadlines
    if (!eventType || eventType === 'ALL' || eventType === 'TASK_DEADLINE') {
      const tasksWhere: any = {
        deadline: { gte: startDate, lte: endDate },
        status: { notIn: ['COMPLETED', 'CANCELLED'] }
      };
      if (isSales) {
        tasksWhere.relatedClientId = null;
        tasksWhere.automatedType = { not: 'PAYMENT_REMINDER' };
      }
      if (userId) {
        tasksWhere.assignedUserId = userId as string;
      }

      const tasks = await prisma.task.findMany({
        where: tasksWhere,
        include: {
          client: { select: { id: true, name: true } },
          lead: { select: { id: true, businessName: true } },
          assignee: { select: { id: true, name: true } },
        }
      });

      tasks.forEach(t => {
        events.push({
          id: `task-${t.id}`,
          title: `Task: ${t.title}`,
          type: 'TASK_DEADLINE',
          start: t.deadline!,
          allDay: true,
          status: t.status,
          priority: t.priority,
          relatedEntity: t.client
            ? { id: t.client.id, name: t.client.name, type: 'CLIENT' }
            : t.lead
            ? { id: t.lead.id, name: t.lead.businessName, type: 'LEAD' }
            : undefined,
          assignedUser: t.assignee || undefined,
        });
      });
    }

    // 3. Lead Follow-ups
    if (!eventType || eventType === 'ALL' || eventType === 'LEAD_FOLLOWUP') {
      const leadsWhere: any = {
        nextFollowUpDate: { gte: startDate, lte: endDate },
        crmStatus: { notIn: ['WON', 'LOST'] }
      };
      if (userId) {
        leadsWhere.assignedUserId = userId as string;
      }

      const leads = await prisma.lead.findMany({
        where: leadsWhere,
        include: {
          assignedUser: { select: { id: true, name: true } },
        }
      });

      leads.forEach(l => {
        events.push({
          id: `lead-followup-${l.id}`,
          title: `${l.followUpType || 'Call'} Follow-up: ${l.businessName}`,
          type: 'LEAD_FOLLOWUP',
          start: l.nextFollowUpDate!,
          allDay: true,
          status: l.crmStatus,
          relatedEntity: { id: l.id, name: l.businessName, type: 'LEAD' },
          assignedUser: l.assignedUser || undefined,
        });
      });
    }

    // 4. Payment Reminders / Income Due (Visible to Admins and Account Holder, Hidden from Sales)
    if (!isSales && (!eventType || eventType === 'ALL' || eventType === 'PAYMENT_DUE')) {
      const paymentWhere: any = {
        dueDate: { gte: startDate, lte: endDate },
        status: { notIn: ['PAID', 'CANCELLED'] }
      };

      if (!isAdmin) {
        paymentWhere.OR = [
          { responsibleUserId: currentUserId },
          { client: { accountManagerId: currentUserId } }
        ];
      }

      const payments = await prisma.payment.findMany({
        where: paymentWhere,
        include: {
          client: { select: { id: true, name: true } },
          responsibleUser: { select: { id: true, name: true } },
        }
      });

      payments.forEach(p => {
        const recTag = p.recurrence && p.recurrence !== 'NONE' ? ` [${p.recurrence}]` : '';
        events.push({
          id: `payment-${p.id}`,
          title: `💰 Income Due: ${p.client.name} (${p.currency === 'INR' ? '₹' : '$'}${p.amount.toLocaleString()})${recTag}`,
          type: 'PAYMENT_DUE',
          start: p.dueDate,
          allDay: true,
          status: p.status,
          relatedEntity: { id: p.client.id, name: p.client.name, type: 'CLIENT' },
          assignedUser: p.responsibleUser || undefined,
        });
      });
    }

    // 5. Expense Due Reminders (Visible to Admins and Account Holder, Hidden from Sales)
    if (!isSales && (!eventType || eventType === 'ALL' || eventType === 'EXPENSE_DUE')) {
      const expenseWhere: any = {
        dueDate: { gte: startDate, lte: endDate },
        status: { notIn: ['PAID', 'CANCELLED'] }
      };

      if (!isAdmin) {
        expenseWhere.OR = [
          { responsibleUserId: currentUserId },
          { client: { accountManagerId: currentUserId } }
        ];
      }

      const expenses = await prisma.expense.findMany({
        where: expenseWhere,
        include: {
          client: { select: { id: true, name: true } },
          responsibleUser: { select: { id: true, name: true } },
        }
      });

      expenses.forEach(e => {
        const recTag = e.recurrence && e.recurrence !== 'NONE' ? ` [${e.recurrence}]` : '';
        const clientName = e.client ? ` — ${e.client.name}` : '';
        events.push({
          id: `expense-${e.id}`,
          title: `💳 Expense Due: ${e.vendor}${clientName} (${e.currency === 'INR' ? '₹' : '$'}${e.amount.toLocaleString()})${recTag}`,
          type: 'EXPENSE_DUE',
          start: e.dueDate,
          allDay: true,
          status: e.status,
          relatedEntity: e.client ? { id: e.client.id, name: e.client.name, type: 'CLIENT' } : undefined,
          assignedUser: e.responsibleUser || undefined,
        });
      });
    }

    res.json({ events });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events.' });
  }
});

export default router;
