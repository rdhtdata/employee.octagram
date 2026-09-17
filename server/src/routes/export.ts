import { Router, Response } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

import { exportLimiter } from '../middleware/security.js';

const router = Router();

/**
 * Neutralizes CSV Formula Injection (DDE attacks).
 * Prepends a single quote if string starts with dangerous formula prefixes (=, +, -, @, \t, \r, |).
 */
function sanitizeCsvCell(value: any): any {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  const firstChar = trimmed.charAt(0);
  if (['=', '+', '-', '@', '\t', '\r', '|'].includes(firstChar)) {
    return `'${value}`;
  }
  return value;
}

function sanitizeRow<T extends Record<string, any>>(row: T): T {
  const cleanRow: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    cleanRow[k] = sanitizeCsvCell(v);
  }
  return cleanRow as T;
}

// GET /api/export/:entity - Export data to CSV (Admin only)
router.get('/:entity', requireAuth, requireRole('ADMIN'), exportLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const entity = req.params.entity as string;
    let data: any[] = [];
    let filename = `octagram_${entity}_export_${new Date().toISOString().split('T')[0]}.csv`;

    if (entity === 'clients') {
      const clients = await prisma.client.findMany({
        include: { accountManager: { select: { name: true } } }
      });
      data = clients.map(c => sanitizeRow({
        ID: c.id,
        Name: c.name,
        Industry: c.industry || '',
        Website: c.website || '',
        Phone: c.phone || '',
        Email: c.email || '',
        Address: c.address || '',
        Status: c.status,
        AccountManager: c.accountManager?.name || '',
        CreatedAt: c.createdAt.toISOString(),
      }));
    } else if (entity === 'leads') {
      const leads = await prisma.lead.findMany({
        include: { assignedUser: { select: { name: true } } }
      });
      data = leads.map(l => sanitizeRow({
        ID: l.id,
        BusinessName: l.businessName,
        Category: l.category || '',
        ContactName: l.contactName || '',
        Phone: l.phone || '',
        Email: l.email || '',
        WebsiteStatus: l.websiteStatus || '',
        WebsiteURL: l.websiteUrl || '',
        Rating: l.rating || '',
        TotalReviews: l.totalReviews || '',
        Address: l.address || '',
        GoogleMapsURL: l.googleMapsUrl || '',
        LeadScore: l.leadScore || 50,
        CRMStatus: l.crmStatus,
        AssignedTo: l.assignedUser?.name || '',
        CreatedAt: l.createdAt.toISOString(),
      }));
    } else if (entity === 'tasks') {
      const tasks = await prisma.task.findMany({
        include: {
          assignee: { select: { name: true } },
          client: { select: { name: true } },
          lead: { select: { businessName: true } }
        }
      });
      data = tasks.map(t => sanitizeRow({
        ID: t.id,
        Title: t.title,
        Priority: t.priority,
        Status: t.status,
        AssignedTo: t.assignee?.name || '',
        RelatedClient: t.client?.name || '',
        RelatedLead: t.lead?.businessName || '',
        Deadline: t.deadline ? t.deadline.toISOString().split('T')[0] : '',
        CreatedAt: t.createdAt.toISOString(),
      }));
    } else if (entity === 'payments') {
      const payments = await prisma.payment.findMany({
        include: {
          client: { select: { name: true } },
          responsibleUser: { select: { name: true } }
        }
      });
      data = payments.map(p => sanitizeRow({
        ID: p.id,
        Client: p.client.name,
        Amount: p.amount,
        Currency: p.currency,
        InvoiceRef: p.invoiceRef || '',
        DueDate: p.dueDate.toISOString().split('T')[0],
        PaymentDate: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',
        Status: p.status,
        ResponsiblePerson: p.responsibleUser?.name || '',
      }));
    } else if (entity === 'expenses') {
      const expenses = await prisma.expense.findMany({
        include: { responsibleUser: { select: { name: true } } }
      });
      data = expenses.map(e => sanitizeRow({
        ID: e.id,
        Vendor: e.vendor,
        Category: e.category,
        Amount: e.amount,
        Currency: e.currency,
        DueDate: e.dueDate.toISOString().split('T')[0],
        PaidDate: e.paidDate ? e.paidDate.toISOString().split('T')[0] : '',
        Status: e.status,
        ResponsiblePerson: e.responsibleUser?.name || '',
      }));
    } else if (entity === 'audit') {
      const logs = await prisma.activityLog.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500
      });
      data = logs.map(l => sanitizeRow({
        Timestamp: l.createdAt.toISOString(),
        User: l.user?.name || 'System',
        Action: l.action,
        EntityType: l.entityType,
        EntityID: l.entityId || '',
        Details: l.details,
      }));
    } else {
      res.status(400).json({ error: 'Invalid entity for export. Supported: clients, leads, tasks, payments, expenses, audit.' });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data.' });
  }
});

export default router;
