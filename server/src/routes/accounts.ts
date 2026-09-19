import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';
import { AutomationEngine } from '../services/automation.js';

const router = Router();

// Base auth requirement for financial records
router.use(requireAuth);

// GET /api/accounts/stats - Financial overview statistics (purely read-only)
router.get('/stats', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { clientId } = req.query;
    const paymentsWhere: any = clientId ? { clientId: clientId as string } : {};
    const expensesWhere: any = clientId ? { relatedClientId: clientId as string } : {};

    const payments = await prisma.payment.findMany({ where: paymentsWhere });
    const expenses = await prisma.expense.findMany({ where: expensesWhere });

    const now = new Date();

    let totalExpected = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;

    for (const p of payments) {
      if (p.status === 'PAID') {
        totalReceived += p.amount;
      } else if (p.status === 'OVERDUE' || (p.dueDate < now && p.status !== 'CANCELLED')) {
        totalOverdue += p.amount;
        totalOutstanding += p.amount;
      } else if (p.status !== 'CANCELLED') {
        totalOutstanding += p.amount;
      }
      if (p.status !== 'CANCELLED') {
        totalExpected += p.amount;
      }
    }

    let totalExpenses = 0;
    let paidExpenses = 0;
    let upcomingExpenses = 0;

    for (const e of expenses) {
      if (e.status !== 'CANCELLED') {
        totalExpenses += e.amount;
        if (e.status === 'PAID') {
          paidExpenses += e.amount;
        } else {
          upcomingExpenses += e.amount;
        }
      }
    }

    res.json({
      incoming: {
        totalExpected,
        totalReceived,
        totalOutstanding,
        totalOverdue,
      },
      outgoing: {
        totalExpenses,
        paidExpenses,
        upcomingExpenses,
      },
      netBalance: totalReceived - paidExpenses,
    });
  } catch (error) {
    console.error('Failed to calculate accounts statistics:', error);
    res.status(500).json({ error: 'Failed to calculate accounts statistics.' });
  }
});

// GET /api/accounts/payments - Incoming payments list (purely read-only)
router.get('/payments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, clientId, responsibleUserId, search } = req.query;

    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (clientId) where.clientId = clientId as string;
    if (responsibleUserId) where.responsibleUserId = responsibleUserId as string;
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { client: { name: { contains: search.trim() } } },
        { invoiceRef: { contains: search.trim() } },
        { notes: { contains: search.trim() } },
      ];
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, industry: true, accountManagerId: true } },
        responsibleUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
    });

    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// POST /api/accounts/payments - Create incoming payment / income
router.post('/payments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { clientId, amount, currency, invoiceRef, dueDate, status, recurrence, responsibleUserId, notes, paymentMethod } = req.body;

    if (!clientId || amount === undefined || !dueDate) {
      res.status(400).json({ error: 'Client, amount, and due date are required.' });
      return;
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        clientId,
        amount: Number(amount),
        currency: currency || 'INR',
        invoiceRef: invoiceRef?.trim() || null,
        dueDate: new Date(dueDate),
        status: status || 'UPCOMING',
        recurrence: recurrence || 'NONE',
        responsibleUserId: responsibleUserId || client.accountManagerId || req.user!.userId,
        notes: notes?.trim() || null,
        paymentMethod: paymentMethod?.trim() || null,
        createdById: req.user!.userId,
      },
      include: {
        client: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } }
      }
    });

    // Run automation to generate payment reminder task & group task for admins
    await AutomationEngine.syncPaymentReminders();

    await logActivity({
      userId: req.user!.userId,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      details: { client: client.name, amount: payment.amount, dueDate: payment.dueDate, recurrence: payment.recurrence }
    });

    res.status(201).json({ payment });
  } catch (error) {
    console.error('Failed to create payment:', error);
    res.status(500).json({ error: 'Failed to create payment.' });
  }
});

// PATCH /api/accounts/payments/:id - Update payment / change status
router.patch('/payments/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { amount, currency, invoiceRef, dueDate, paymentDate, status, recurrence, responsibleUserId, notes, paymentMethod } = req.body;

    const existing = await prisma.payment.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }

    const updateData: any = {};
    if (amount !== undefined) updateData.amount = Number(amount);
    if (currency !== undefined) updateData.currency = currency;
    if (invoiceRef !== undefined) updateData.invoiceRef = invoiceRef?.trim() || null;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'PAID' && !paymentDate && !existing.paymentDate) {
        updateData.paymentDate = new Date();
      }
    }
    if (paymentDate !== undefined) updateData.paymentDate = paymentDate ? new Date(paymentDate) : null;
    if (recurrence !== undefined) updateData.recurrence = recurrence;
    if (responsibleUserId !== undefined) updateData.responsibleUserId = responsibleUserId || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod?.trim() || null;

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } }
      }
    });

    // Handle payment status automations (mark reminder tasks completed & spawn next cycle if recurring)
    if (status) {
      await AutomationEngine.handlePaymentStatusChange(id, status);
    }

    await logActivity({
      userId: req.user!.userId,
      action: status === 'PAID' ? 'PAYMENT_RECORDED' : 'UPDATE',
      entityType: 'PAYMENT',
      entityId: id,
      details: { client: existing.client.name, amount: updated.amount, status: updated.status, recurrence: updated.recurrence }
    });

    res.json({ payment: updated });
  } catch (error) {
    console.error('Failed to update payment:', error);
    res.status(500).json({ error: 'Failed to update payment.' });
  }
});

// DELETE /api/accounts/payments/:id
router.delete('/payments/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }

    await prisma.payment.delete({ where: { id } });

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'PAYMENT',
      entityId: id,
      details: { client: payment.client.name, amount: payment.amount }
    });

    res.json({ success: true, message: 'Payment deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment.' });
  }
});

// GET /api/accounts/expenses - Outgoing expenses list
router.get('/expenses', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, status, clientId, search } = req.query;

    const where: any = {};
    if (category && typeof category === 'string' && category !== 'ALL') {
      where.category = category;
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (clientId) {
      where.relatedClientId = clientId as string;
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { vendor: { contains: search.trim() } },
        { notes: { contains: search.trim() } },
        { client: { name: { contains: search.trim() } } },
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
    });

    res.json({ expenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
});

// POST /api/accounts/expenses - Create outgoing expense
router.post('/expenses', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vendor, category, amount, currency, dueDate, status, recurrence, relatedClientId, clientId, notes, responsibleUserId } = req.body;

    if (!vendor || amount === undefined || !dueDate) {
      res.status(400).json({ error: 'Vendor, amount, and due date are required.' });
      return;
    }

    const targetClientId = relatedClientId || clientId || null;

    const expense = await prisma.expense.create({
      data: {
        vendor: vendor.trim(),
        category: category || 'SOFTWARE',
        amount: Number(amount),
        currency: currency || 'INR',
        dueDate: new Date(dueDate),
        status: status || 'UPCOMING',
        recurrence: recurrence || 'NONE',
        relatedClientId: targetClientId,
        notes: notes?.trim() || null,
        responsibleUserId: responsibleUserId || req.user!.userId,
        createdById: req.user!.userId,
      },
      include: {
        client: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } }
      }
    });

    await AutomationEngine.syncExpenseReminders();

    await logActivity({
      userId: req.user!.userId,
      action: 'CREATE',
      entityType: 'EXPENSE',
      entityId: expense.id,
      details: { vendor: expense.vendor, amount: expense.amount, category: expense.category, recurrence: expense.recurrence, client: expense.client?.name }
    });

    res.status(201).json({ expense });
  } catch (error) {
    console.error('Failed to create expense:', error);
    res.status(500).json({ error: 'Failed to create expense.' });
  }
});

// PATCH /api/accounts/expenses/:id - Update expense
router.patch('/expenses/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { vendor, category, amount, currency, dueDate, paidDate, status, recurrence, relatedClientId, clientId, notes, responsibleUserId } = req.body;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    const updateData: any = {};
    if (vendor !== undefined) updateData.vendor = vendor.trim();
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (currency !== undefined) updateData.currency = currency;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'PAID' && !paidDate && !existing.paidDate) {
        updateData.paidDate = new Date();
      }
    }
    if (paidDate !== undefined) updateData.paidDate = paidDate ? new Date(paidDate) : null;
    if (recurrence !== undefined) updateData.recurrence = recurrence;
    if (relatedClientId !== undefined || clientId !== undefined) {
      updateData.relatedClientId = relatedClientId || clientId || null;
    }
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (responsibleUserId !== undefined) updateData.responsibleUserId = responsibleUserId || null;

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } }
      }
    });

    if (status) {
      await AutomationEngine.handleExpenseStatusChange(id, status);
    }

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'EXPENSE',
      entityId: id,
      details: { vendor: updated.vendor, amount: updated.amount, status: updated.status }
    });

    res.json({ expense: updated });
  } catch (error) {
    console.error('Failed to update expense:', error);
    res.status(500).json({ error: 'Failed to update expense.' });
  }
});

// DELETE /api/accounts/expenses/:id
router.delete('/expenses/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    await prisma.expense.delete({ where: { id } });

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'EXPENSE',
      entityId: id,
      details: { vendor: expense.vendor, amount: expense.amount }
    });

    res.json({ success: true, message: 'Expense deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

export default router;
