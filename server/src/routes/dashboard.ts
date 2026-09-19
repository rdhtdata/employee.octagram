import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AutomationEngine } from '../services/automation.js';

const router = Router();

let lastSyncTime = 0;
let isSyncing = false;
const SYNC_THROTTLE_MS = 30 * 60 * 1000; // Strongly throttled: max once every 30 minutes

// GET /api/dashboard - Personalized operations hub dashboard (read-only with throttled background sync guard)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!.userId;
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'DEV';
    const isSales = req.user!.role === 'SALES';

    // Strongly throttled, non-blocking on-demand sync with mutex guard to prevent concurrent execution
    const nowMs = Date.now();
    if (!isSyncing && (nowMs - lastSyncTime > SYNC_THROTTLE_MS)) {
      isSyncing = true;
      lastSyncTime = nowMs;
      (async () => {
        try {
          await AutomationEngine.syncPaymentReminders();
          await AutomationEngine.syncLeadFollowUps();
        } catch (e) {
          console.warn('Auto-sync notice in dashboard:', e);
        } finally {
          isSyncing = false;
        }
      })();
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const threeDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59, 999);

    // 1. Priority Urgent Items (🔴 Overdue / Critical tasks / Urgent Follow-ups / Overdue payments)
    const priorityItems: Array<{
      id: string;
      urgency: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'CRITICAL';
      title: string;
      subtitle: string;
      dueDate?: Date | string | null;
      type: 'TASK' | 'MEETING' | 'LEAD_FOLLOWUP' | 'PAYMENT';
      url: string;
      priorityBadge: string;
      actionType?: string;
    }> = [];

    // Urgent Tasks
    const urgentTasksRaw = await prisma.task.findMany({
      where: {
        AND: [
          isAdmin ? {} : {
            OR: [
              { assignedUserId: currentUserId },
              { collaborators: { some: { userId: currentUserId } } },
              { isPersonal: true, createdById: currentUserId }
            ]
          },
          isSales ? { relatedClientId: null, automatedType: null } : {},
          { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          {
            OR: [
              { deadline: { lt: startOfToday } },
              { deadline: { gte: startOfToday, lte: endOfToday } },
              { priority: { in: ['HIGH', 'CRITICAL'] } }
            ]
          }
        ]
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
      },
      take: 12,
      orderBy: [{ deadline: 'asc' }, { priority: 'desc' }]
    });

    const urgentTasks = isSales ? urgentTasksRaw.filter(t => {
      if (t.relatedClientId || t.client) return false;
      if (t.automatedType === 'PAYMENT_REMINDER' || t.automatedType === 'EXPENSE_REMINDER') return false;
      const text = ((t.title || '') + ' ' + (t.description || '')).toLowerCase();
      if (text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) return false;
      return true;
    }).slice(0, 6) : urgentTasksRaw.slice(0, 6);

    urgentTasks.forEach(t => {
      let urgency: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'CRITICAL' = 'DUE_SOON';
      if (t.deadline && t.deadline < startOfToday) urgency = 'OVERDUE';
      else if (t.deadline && t.deadline <= endOfToday) urgency = 'DUE_TODAY';
      else if (t.priority === 'CRITICAL') urgency = 'CRITICAL';

      priorityItems.push({
        id: t.id,
        urgency,
        title: t.title,
        subtitle: t.client ? `Client: ${t.client.name}` : t.lead ? `Lead: ${t.lead.businessName}` : 'Internal Task',
        dueDate: t.deadline,
        type: 'TASK',
        url: `/tasks?taskId=${t.id}`,
        priorityBadge: t.priority,
      });
    });

    // Urgent Follow-ups
    const urgentLeads = await prisma.lead.findMany({
      where: {
        assignedUserId: currentUserId,
        nextFollowUpDate: { lte: threeDaysLater },
        crmStatus: { notIn: ['WON', 'LOST'] }
      },
      take: 4,
      orderBy: { nextFollowUpDate: 'asc' }
    });

    urgentLeads.forEach(l => {
      let urgency: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'CRITICAL' = 'DUE_SOON';
      if (l.nextFollowUpDate && l.nextFollowUpDate < startOfToday) urgency = 'OVERDUE';
      else if (l.nextFollowUpDate && l.nextFollowUpDate <= endOfToday) urgency = 'DUE_TODAY';

      priorityItems.push({
        id: l.id,
        urgency,
        title: `${l.followUpType || 'Call'} Follow-up — ${l.businessName}`,
        subtitle: `Contact: ${l.contactName || 'N/A'} • ${l.phone || 'No phone'}`,
        dueDate: l.nextFollowUpDate,
        type: 'LEAD_FOLLOWUP',
        url: `/crm/leads/${l.id}`,
        priorityBadge: l.crmStatus,
      });
    });

    // Overdue/Upcoming Payments (ADMIN ONLY)
    if (isAdmin) {
      const urgentPayments = await prisma.payment.findMany({
        where: {
          status: { in: ['UPCOMING', 'DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
          dueDate: { lte: threeDaysLater }
        },
        include: { client: { select: { id: true, name: true } } },
        take: 3,
        orderBy: { dueDate: 'asc' }
      });

      urgentPayments.forEach(p => {
        const isOverdue = p.dueDate < startOfToday;
        priorityItems.push({
          id: p.id,
          urgency: isOverdue ? 'OVERDUE' : 'DUE_SOON',
          title: `Payment Collection: ${p.client.name}`,
          subtitle: `${p.currency === 'INR' ? '₹' : '$'}${p.amount.toLocaleString()} due ${p.dueDate.toISOString().split('T')[0]}`,
          dueDate: p.dueDate,
          type: 'PAYMENT',
          url: `/clients/${p.clientId}?tab=payments`,
          priorityBadge: p.status,
        });
      });
    }

    // 2. My Tasks Sections
    const myTasksWhere: any = {
      OR: [
        { assignedUserId: currentUserId },
        { collaborators: { some: { userId: currentUserId } } },
        { isPersonal: true, createdById: currentUserId }
      ]
    };
    if (isSales) {
      myTasksWhere.relatedClientId = null;
      myTasksWhere.automatedType = null;
    }

    const myTasksRaw = await prisma.task.findMany({
      where: myTasksWhere,
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }, { priority: 'desc' }]
    });

    const myTasks = isSales ? myTasksRaw.filter(t => {
      if (t.relatedClientId || t.client) return false;
      if (t.automatedType === 'PAYMENT_REMINDER' || t.automatedType === 'EXPENSE_REMINDER') return false;
      const text = ((t.title || '') + ' ' + (t.description || '')).toLowerCase();
      if (text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) return false;
      return true;
    }) : myTasksRaw;

    const myTasksToday = myTasks.filter(t => t.deadline && t.deadline >= startOfToday && t.deadline <= endOfToday && t.status !== 'COMPLETED');
    const myTasksOverdue = myTasks.filter(t => t.deadline && t.deadline < startOfToday && t.status !== 'COMPLETED');
    const myTasksUpcoming = myTasks.filter(t => (!t.deadline || t.deadline > endOfToday) && t.status !== 'COMPLETED');
    const myTasksCompleted = myTasks.filter(t => t.status === 'COMPLETED').slice(0, 10);

    // 3. Shared Team Tasks (tasks involving other team members)
    const teamTasksWhere: any = {
      isPersonal: false,
      status: { notIn: ['COMPLETED', 'CANCELLED'] }
    };
    if (isSales) {
      teamTasksWhere.relatedClientId = null;
      teamTasksWhere.automatedType = null;
    }

    const teamTasksRaw = await prisma.task.findMany({
      where: teamTasksWhere,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
      },
      take: 16,
      orderBy: [{ deadline: 'asc' }, { priority: 'desc' }]
    });

    const teamTasks = isSales ? teamTasksRaw.filter(t => {
      if (t.relatedClientId || t.client) return false;
      if (t.automatedType === 'PAYMENT_REMINDER' || t.automatedType === 'EXPENSE_REMINDER') return false;
      const text = ((t.title || '') + ' ' + (t.description || '')).toLowerCase();
      if (text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) return false;
      return true;
    }).slice(0, 8) : teamTasksRaw.slice(0, 8);

    // 4. Upcoming Meetings & Reminders
    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        date: { gte: startOfToday },
        ...(isAdmin ? {} : {
          OR: [
            { createdById: currentUserId },
            { participants: { some: { userId: currentUserId } } }
          ]
        })
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, businessName: true } },
        participants: { include: { user: { select: { id: true, name: true } } } }
      },
      take: 5,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });

    // 5. Recent Activity Feed
    const recentActivity = await prisma.activityLog.findMany({
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, role: true } }
      },
      take: 12,
      orderBy: { createdAt: 'desc' }
    });

    // 6. Admin High-Level KPIs (if admin)
    let adminStats = null;
    if (isAdmin) {
      const [
        totalActiveClients,
        newLeadsCount,
        openTasksCount,
        openTicketsCount,
      ] = await Promise.all([
        prisma.client.count({ where: { status: 'ACTIVE' } }),
        prisma.lead.count({ where: { crmStatus: { in: ['NEW', 'CONTACTED', 'ENGAGED'] } } }),
        prisma.task.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
        prisma.ticket.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      ]);

      adminStats = {
        totalActiveClients,
        newLeadsCount,
        openTasksCount,
        openTicketsCount,
      };
    }

    res.json({
      priorityItems,
      myTasks: {
        today: myTasksToday,
        overdue: myTasksOverdue,
        upcoming: myTasksUpcoming,
        completed: myTasksCompleted,
        totalOpenCount: myTasksToday.length + myTasksOverdue.length + myTasksUpcoming.length,
      },
      teamTasks,
      upcomingMeetings,
      recentActivity,
      adminStats,
    });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

export default router;
