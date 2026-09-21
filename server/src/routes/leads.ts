import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logActivity } from '../services/auditLogger.js';
import { LeadParserService, NormalizedLead } from '../services/leadParser.js';
import { AutomationEngine } from '../services/automation.js';

import path from 'path';
import { randomUUID } from 'crypto';
import { importLimiter } from '../middleware/security.js';

const router = Router();

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10,                  // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Invalid file type "${ext}". Only .xlsx, .xls, and .csv files are supported.`));
    }
    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(new Error(`Unsupported file MIME type "${file.mimetype}".`));
    }
    cb(null, true);
  },
});

// GET /api/leads - Lead list with rich filters
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      crmStatus,
      assignedUserId,
      industry,
      category,
      websiteStatus,
      minScore,
      maxScore,
      leadQuality,
      minRating,
      hasPhone,
      hasWebsite,
      hasMaps,
    } = req.query;

    const where: any = {};

    // 1. Pipeline Status filter
    if (crmStatus && typeof crmStatus === 'string' && crmStatus !== 'ALL') {
      where.crmStatus = crmStatus;
    }

    // 2. Assigned Rep filter
    if (assignedUserId && typeof assignedUserId === 'string' && assignedUserId !== 'ALL') {
      if (assignedUserId === 'UNASSIGNED') {
        where.assignedUserId = null;
      } else {
        where.assignedUserId = assignedUserId;
      }
    }

    // 3. Industry filter
    if (industry && typeof industry === 'string' && industry !== 'ALL') {
      where.industry = industry;
    }

    // 4. Category filter
    if (category && typeof category === 'string' && category !== 'ALL') {
      where.category = { contains: category };
    }

    // 5. Website Status filter
    if (websiteStatus && typeof websiteStatus === 'string' && websiteStatus !== 'ALL') {
      where.websiteStatus = { contains: websiteStatus };
    }

    // 6. Lead Quality / Score range
    if (leadQuality === 'HOT') {
      where.leadScore = { gte: 80 };
    } else if (leadQuality === 'WARM') {
      where.leadScore = { gte: 50, lt: 80 };
    } else if (leadQuality === 'COLD') {
      where.leadScore = { lt: 50 };
    } else {
      if (minScore && !isNaN(Number(minScore))) {
        where.leadScore = { ...(where.leadScore || {}), gte: Number(minScore) };
      }
      if (maxScore && !isNaN(Number(maxScore))) {
        where.leadScore = { ...(where.leadScore || {}), lte: Number(maxScore) };
      }
    }

    // 7. Star Rating filter
    if (minRating && !isNaN(Number(minRating))) {
      where.rating = { gte: Number(minRating) };
    }

    // 8. Contact & Web availability filters
    if (hasPhone === 'true') {
      where.phone = { not: null };
    }
    if (hasWebsite === 'true') {
      where.websiteUrl = { not: null };
    }
    if (hasMaps === 'true') {
      where.googleMapsUrl = { not: null };
    }

    // 9. Full text search
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { businessName: { contains: q } },
        { contactName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { category: { contains: q } },
        { industry: { contains: q } },
        { address: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    // 10. Date Added / CreatedAt filter
    const { dateAdded, dateFrom, dateTo, sortBy, sortOrder } = req.query;
    if (dateAdded === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      where.createdAt = { gte: startOfDay };
    } else if (dateAdded === 'last7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      where.createdAt = { gte: d };
    } else if (dateAdded === 'last30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      where.createdAt = { gte: d };
    } else if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(String(dateFrom));
      if (dateTo) {
        const end = new Date(String(dateTo));
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 11. Dynamic Ordering
    const validSortFields = ['businessName', 'leadScore', 'rating', 'totalReviews', 'crmStatus', 'createdAt', 'nextFollowUpDate', 'industry'];
    const orderDirection: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    let orderBy: any = [{ createdAt: 'desc' }, { leadScore: 'desc' }];

    if (sortBy && typeof sortBy === 'string' && validSortFields.includes(sortBy)) {
      orderBy = [{ [sortBy]: orderDirection }];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
        convertedClient: { select: { id: true, name: true } },
        _count: {
          select: {
            tasks: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
            communications: true,
            meetings: true,
          }
        }
      },
      orderBy
    });

    res.json({ leads });
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads.' });
  }
});

// GET /api/leads/meta/facets - Distinct filter options and aggregate summary stats
router.get('/meta/facets', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const leads = await prisma.lead.findMany({
      select: {
        industry: true,
        category: true,
        websiteStatus: true,
        leadScore: true,
        assignedUserId: true,
        crmStatus: true,
      }
    });

    const industries = Array.from(new Set(leads.map(l => l.industry).filter(Boolean) as string[])).sort();
    const categories = Array.from(new Set(leads.map(l => l.category).filter(Boolean) as string[])).sort();
    const websiteStatuses = Array.from(new Set(leads.map(l => l.websiteStatus).filter(Boolean) as string[])).sort();

    res.json({
      industries,
      categories,
      websiteStatuses,
      totalCount: leads.length,
      hotCount: leads.filter(l => (l.leadScore || 0) >= 80).length,
      warmCount: leads.filter(l => (l.leadScore || 0) >= 50 && (l.leadScore || 0) < 80).length,
      coldCount: leads.filter(l => (l.leadScore || 0) < 50).length,
      unassignedCount: leads.filter(l => !l.assignedUserId).length,
    });
  } catch (error) {
    console.error('Failed to fetch lead facets:', error);
    res.status(500).json({ error: 'Failed to fetch lead facets.' });
  }
});

// GET /api/leads/pipeline - Grouped leads for Kanban board
router.get('/pipeline', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stages = ['NEW', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const leads = await prisma.lead.findMany({
      include: {
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
        convertedClient: { select: { id: true, name: true } },
      },
      orderBy: [{ leadScore: 'desc' }, { updatedAt: 'desc' }]
    });

    const pipeline: Record<string, typeof leads> = {};
    stages.forEach(stage => {
      pipeline[stage] = leads.filter(l => l.crmStatus === stage);
    });

    res.json({ pipeline, stages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pipeline.' });
  }
});

// GET /api/leads/:id - Single lead detail with history
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        convertedClient: { select: { id: true, name: true, status: true } },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { deadline: 'asc' }
        },
        meetings: {
          include: { creator: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' }
        },
        communications: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { occurredAt: 'desc' }
        },
        documents: true,
      }
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead details.' });
  }
});

// POST /api/leads - Create lead
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      businessName,
      category,
      industry,
      contactName,
      phone,
      email,
      websiteStatus,
      websiteUrl,
      rating,
      totalReviews,
      address,
      googleMapsUrl,
      leadScore,
      crmStatus,
      assignedUserId,
      nextFollowUpDate,
      followUpType,
      notes,
    } = req.body;

    if (!businessName || !businessName.trim()) {
      res.status(400).json({ error: 'Business name is required.' });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        businessName: businessName.trim(),
        category: category?.trim() || null,
        industry: industry?.trim() || null,
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        websiteStatus: websiteStatus || null,
        websiteUrl: websiteUrl?.trim() || null,
        rating: rating !== undefined && !isNaN(Number(rating)) ? Number(rating) : null,
        totalReviews: totalReviews !== undefined && !isNaN(Number(totalReviews)) ? Number(totalReviews) : null,
        address: address?.trim() || null,
        googleMapsUrl: googleMapsUrl?.trim() || null,
        leadScore: leadScore !== undefined && !isNaN(Number(leadScore)) ? Number(leadScore) : 50,
        crmStatus: crmStatus || 'NEW',
        assignedUserId: assignedUserId || req.user!.userId,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        followUpType: followUpType || 'Call',
        notes: notes?.trim() || null,
      },
      include: {
        assignedUser: { select: { id: true, name: true } }
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'CREATE',
      entityType: 'LEAD',
      entityId: lead.id,
      details: { businessName: lead.businessName, crmStatus: lead.crmStatus }
    });

    if (lead.nextFollowUpDate && lead.assignedUserId) {
      AutomationEngine.syncLeadFollowUps().catch((e) => console.warn('Lead follow-up sync warning on create:', e));
    }

    res.status(201).json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lead.' });
  }
});

// PATCH /api/leads/:id - Update lead / stage / follow-up
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const {
      businessName,
      category,
      industry,
      contactName,
      phone,
      email,
      websiteStatus,
      websiteUrl,
      rating,
      totalReviews,
      address,
      googleMapsUrl,
      leadScore,
      crmStatus,
      assignedUserId,
      nextFollowUpDate,
      followUpType,
      notes,
    } = req.body;

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        businessName: businessName !== undefined ? businessName.trim() : undefined,
        category: category !== undefined ? category?.trim() : undefined,
        industry: industry !== undefined ? industry?.trim() : undefined,
        contactName: contactName !== undefined ? contactName?.trim() : undefined,
        phone: phone !== undefined ? phone?.trim() : undefined,
        email: email !== undefined ? email?.trim() : undefined,
        websiteStatus: websiteStatus !== undefined ? websiteStatus : undefined,
        websiteUrl: websiteUrl !== undefined ? websiteUrl?.trim() : undefined,
        rating: rating !== undefined ? (rating === null ? null : Number(rating)) : undefined,
        totalReviews: totalReviews !== undefined ? (totalReviews === null ? null : Number(totalReviews)) : undefined,
        address: address !== undefined ? address?.trim() : undefined,
        googleMapsUrl: googleMapsUrl !== undefined ? googleMapsUrl?.trim() : undefined,
        leadScore: leadScore !== undefined ? Number(leadScore) : undefined,
        crmStatus: crmStatus !== undefined ? crmStatus : undefined,
        assignedUserId: assignedUserId !== undefined ? (assignedUserId || null) : undefined,
        nextFollowUpDate: nextFollowUpDate !== undefined ? (nextFollowUpDate ? new Date(nextFollowUpDate) : null) : undefined,
        followUpType: followUpType !== undefined ? followUpType : undefined,
        notes: notes !== undefined ? notes?.trim() : undefined,
      },
      include: {
        assignedUser: { select: { id: true, name: true } }
      }
    });

    await logActivity({
      userId: req.user!.userId,
      action: 'UPDATE',
      entityType: 'LEAD',
      entityId: updated.id,
      details: { businessName: updated.businessName, crmStatus: updated.crmStatus }
    });

    if (updated.nextFollowUpDate && updated.assignedUserId) {
      AutomationEngine.syncLeadFollowUps().catch((e) => console.warn('Lead follow-up sync warning on update:', e));
    }

    res.json({ lead: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lead.' });
  }
});

// POST /api/leads/:id/convert - Convert Lead to Client
router.post('/:id/convert', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { convertedClient: true }
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    if (lead.convertedClientId) {
      res.status(400).json({ error: 'Lead has already been converted to a client.', clientId: lead.convertedClientId });
      return;
    }

    const { industry, accountManagerId } = req.body;

    // Create client and link lead
    const client = await prisma.client.create({
      data: {
        name: lead.businessName,
        industry: industry || lead.category || null,
        website: lead.websiteUrl || null,
        phone: lead.phone || null,
        email: lead.email || null,
        address: lead.address || null,
        status: 'ACTIVE',
        accountManagerId: accountManagerId || lead.assignedUserId || req.user!.userId,
        convertedLeadId: lead.id,
        contacts: lead.contactName ? {
          create: {
            name: lead.contactName,
            phone: lead.phone || null,
            email: lead.email || null,
            isPrimary: true,
          }
        } : undefined
      }
    });

    // Update lead status to WON and link convertedClientId
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        crmStatus: 'WON',
        convertedClientId: client.id,
      }
    });

    // Log Activity
    await logActivity({
      userId: req.user!.userId,
      action: 'CONVERT',
      entityType: 'LEAD',
      entityId: lead.id,
      details: { leadName: lead.businessName, createdClientId: client.id }
    });

    res.json({
      success: true,
      message: `${lead.businessName} was successfully converted to an active client.`,
      client,
      lead: updatedLead
    });
  } catch (error) {
    console.error('Failed to convert lead to client:', error);
    res.status(500).json({ error: 'Failed to convert lead to client.' });
  }
});

// POST /api/leads/import/preview - Multi-file upload preview and duplicate detection
router.post('/import/preview', requireAuth, importLimiter, upload.array('files', 10), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const reqStart = Date.now();
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Please select at least one Excel (.xlsx) or CSV file to upload.' });
      return;
    }

    console.log(`📥 [IMPORT-PREVIEW] Received ${files.length} file(s) for preview processing.`);
    const parseStart = Date.now();
    let allNormalized: NormalizedLead[] = [];
    const parseErrors: { file: string; row: number; reason: string }[] = [];

    for (const file of files) {
      // Sanitize original file name
      const safeFileName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      try {
        const { rows, errors } = LeadParserService.parseFileBuffer(file.buffer, safeFileName);
        allNormalized = allNormalized.concat(rows);
        errors.forEach(e => parseErrors.push({ file: safeFileName, ...e }));
      } catch (err: any) {
        parseErrors.push({ file: safeFileName, row: 0, reason: `Failed to parse file: ${err.message}` });
      }
    }
    const parseDuration = Date.now() - parseStart;
    console.log(`📊 [IMPORT-PREVIEW] Parsed ${allNormalized.length} row(s) with ${parseErrors.length} error(s) in ${parseDuration}ms`);

    // Check duplicates against existing database leads
    const dupStart = Date.now();
    const { unique, duplicates } = await LeadParserService.checkDuplicates(allNormalized);
    const dupDuration = Date.now() - dupStart;
    console.log(`🔍 [IMPORT-PREVIEW] Deduplication found ${unique.length} new lead(s) and ${duplicates.length} duplicate(s) in ${dupDuration}ms`);

    const totalDuration = Date.now() - reqStart;
    console.log(`⚡ [IMPORT-PREVIEW] Total preview generated in ${totalDuration}ms`);

    res.json({
      summary: {
        totalFiles: files.length,
        totalRows: allNormalized.length + parseErrors.length,
        validNewCount: unique.length,
        duplicateCount: duplicates.length,
        errorCount: parseErrors.length,
      },
      uniqueLeads: unique,
      duplicates,
      errors: parseErrors,
    });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ error: 'Failed to process spreadsheet files.' });
  }
});

// POST /api/leads/import/confirm - Batch import with duplicate resolution
router.post('/import/confirm', requireAuth, importLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const reqStart = Date.now();
  try {
    const { uniqueLeads, resolvedDuplicates, assignedUserId } = req.body;

    const currentUserId = req.user!.userId;
    // Determine assigned user: if 'UNASSIGNED' -> null, else specified user or fallback to current logged-in user
    const targetAssigneeId = assignedUserId === 'UNASSIGNED' ? null : (assignedUserId || currentUserId);
    let importedCount = 0;
    let mergedCount = 0;
    let skippedCount = 0;

    const leadsToInsert: any[] = [];

    // 1. Prepare unique leads
    if (Array.isArray(uniqueLeads) && uniqueLeads.length > 0) {
      for (const lead of uniqueLeads) {
        leadsToInsert.push({
          id: randomUUID(),
          businessName: lead.businessName,
          category: lead.category || null,
          industry: lead.industry || null,
          contactName: lead.contactName || null,
          phone: lead.phone || null,
          email: lead.email || null,
          websiteStatus: lead.websiteStatus || null,
          websiteUrl: lead.websiteUrl || null,
          rating: lead.rating !== undefined ? lead.rating : null,
          totalReviews: lead.totalReviews !== undefined ? lead.totalReviews : null,
          address: lead.address || null,
          googleMapsUrl: lead.googleMapsUrl || null,
          leadScore: lead.leadScore || 50,
          crmStatus: lead.crmStatus || 'NEW',
          assignedUserId: targetAssigneeId,
          notes: lead.notes || (lead.sourceFile ? `Imported from ${lead.sourceFile}` : null),
        });
      }
    }

    // 2. Prepare duplicate resolutions
    const mergeUpdates: any[] = [];
    if (Array.isArray(resolvedDuplicates)) {
      for (const item of resolvedDuplicates) {
        const { incoming, resolution, existingId } = item;

        if (resolution === 'KEEP_BOTH') {
          leadsToInsert.push({
            id: randomUUID(),
            businessName: `${incoming.businessName} (Copy)`,
            category: incoming.category || null,
            industry: incoming.industry || null,
            contactName: incoming.contactName || null,
            phone: incoming.phone || null,
            email: incoming.email || null,
            websiteStatus: incoming.websiteStatus || null,
            websiteUrl: incoming.websiteUrl || null,
            rating: incoming.rating !== undefined ? incoming.rating : null,
            totalReviews: incoming.totalReviews !== undefined ? incoming.totalReviews : null,
            address: incoming.address || null,
            googleMapsUrl: incoming.googleMapsUrl || null,
            leadScore: incoming.leadScore || 50,
            crmStatus: incoming.crmStatus || 'NEW',
            assignedUserId: targetAssigneeId,
            notes: incoming.notes || (incoming.sourceFile ? `Imported duplicate from ${incoming.sourceFile}` : null),
          });
        } else if (resolution === 'MERGE' && existingId) {
          mergeUpdates.push({ existingId, incoming });
        } else {
          skippedCount++;
        }
      }
    }

    // 3. Execute all writes inside a single atomic SQLite transaction
    // This holds the lock for milliseconds instead of sequential per-chunk lock churning
    console.log(`💾 [IMPORT-CONFIRM] Starting atomic import transaction: ${leadsToInsert.length} inserts, ${mergeUpdates.length} merges, ${skippedCount} skipped`);
    const txStart = Date.now();

    await prisma.$transaction(async (tx) => {
      // Insert in chunks of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
        const chunk = leadsToInsert.slice(i, i + BATCH_SIZE);
        await tx.lead.createMany({
          data: chunk,
        });
        importedCount += chunk.length;
      }

      // Process merge updates
      if (mergeUpdates.length > 0) {
        const existingIds = mergeUpdates.map(m => m.existingId);
        const existingRecords = await tx.lead.findMany({
          where: { id: { in: existingIds } },
          select: { id: true, category: true, industry: true, contactName: true, phone: true, email: true, websiteStatus: true, websiteUrl: true, address: true, googleMapsUrl: true, notes: true },
        });
        const existingMap = new Map(existingRecords.map(r => [r.id, r]));

        for (const { existingId, incoming } of mergeUpdates) {
          const existing = existingMap.get(existingId);
          if (existing) {
            await tx.lead.update({
              where: { id: existingId },
              data: {
                category: existing.category || incoming.category || null,
                industry: existing.industry || incoming.industry || null,
                contactName: existing.contactName || incoming.contactName || null,
                phone: existing.phone || incoming.phone || null,
                email: existing.email || incoming.email || null,
                websiteStatus: existing.websiteStatus || incoming.websiteStatus || null,
                websiteUrl: existing.websiteUrl || incoming.websiteUrl || null,
                address: existing.address || incoming.address || null,
                googleMapsUrl: existing.googleMapsUrl || incoming.googleMapsUrl || null,
                notes: existing.notes ? `${existing.notes}\n[Merged info from import: ${incoming.notes || ''}]` : incoming.notes,
              }
            });
            mergedCount++;
          }
        }
      }
    }, { timeout: 30000 });

    const txDuration = Date.now() - txStart;
    console.log(`✅ [IMPORT-CONFIRM] Transaction committed in ${txDuration}ms. Total duration: ${Date.now() - reqStart}ms`);

    logActivity({
      userId: currentUserId,
      action: 'IMPORT',
      entityType: 'LEAD',
      details: { imported: importedCount, merged: mergedCount, skipped: skippedCount }
    }).catch(e => console.warn('Import activity log warning:', e));

    res.json({
      success: true,
      summary: {
        imported: importedCount,
        merged: mergedCount,
        skipped: skippedCount,
        totalProcessed: importedCount + mergedCount + skippedCount,
      }
    });
  } catch (error) {
    console.error('Import confirmation error:', error);
    res.status(500).json({ error: 'Failed to finalize lead import.' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    await prisma.lead.delete({ where: { id } });

    await logActivity({
      userId: req.user!.userId,
      action: 'DELETE',
      entityType: 'LEAD',
      entityId: id,
      details: { businessName: lead.businessName }
    });

    res.json({ success: true, message: 'Lead deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lead.' });
  }
});

export default router;
