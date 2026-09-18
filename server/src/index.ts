import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import tasksRoutes from './routes/tasks.js';
import clientsRoutes from './routes/clients.js';
import leadsRoutes from './routes/leads.js';
import accountsRoutes from './routes/accounts.js';
import meetingsRoutes from './routes/meetings.js';
import calendarRoutes from './routes/calendar.js';
import ticketsRoutes from './routes/tickets.js';
import notificationsRoutes from './routes/notifications.js';
import searchRoutes from './routes/search.js';
import auditRoutes from './routes/audit.js';
import exportRoutes from './routes/export.js';
import dashboardRoutes from './routes/dashboard.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AutomationEngine } from './services/automation.js';

const app = express();
app.set('trust proxy', 1);

const rawPort = process.env.PORT || 5001;
const PORT = isNaN(Number(rawPort)) ? rawPort : Number(rawPort);

async function ensureInitialUsers() {
  try {
    const adminPasswordHash = await bcrypt.hash('zidane123', 10);
    const salesPasswordHash = await bcrypt.hash('octagram123', 10);

    const initialUsers = [
      {
        email: 'harsh@octagramai.com',
        name: 'Harsh Tripathi',
        role: 'DEV',
        department: 'Engineering & Leadership',
        plainPassword: 'zidane123',
        passwordHash: adminPasswordHash,
      },
      {
        email: 'vishnu@octagramai.com',
        name: 'Vishnu',
        role: 'ADMIN',
        department: 'Leadership & Operations',
        plainPassword: 'zidane123',
        passwordHash: adminPasswordHash,
      },
      {
        email: 'sanjana@octagramai.com',
        name: 'Sanjana',
        role: 'ADMIN',
        department: 'Leadership & Operations',
        plainPassword: 'zidane123',
        passwordHash: adminPasswordHash,
      },
      {
        email: 'sumaiya@octagramai.com',
        name: 'Sumaiya',
        role: 'SALES',
        department: 'Sales & Outreach',
        plainPassword: 'octagram123',
        passwordHash: salesPasswordHash,
      },
    ];

    for (const u of initialUsers) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: u.email,
            name: u.name,
            role: u.role as any,
            department: u.department,
            plainPassword: u.plainPassword,
            passwordHash: u.passwordHash,
            isActive: true,
          }
        });
        console.log(`👤 Created initial user account: ${u.email} (${u.role})`);
      } else {
        const updateData: any = {};
        if (!existing.plainPassword) {
          updateData.plainPassword = u.plainPassword;
        }
        if (u.email === 'harsh@octagramai.com' && existing.role !== 'DEV') {
          updateData.role = 'DEV';
          updateData.department = 'Engineering & Leadership';
          console.log(`⚡ Upgraded Harsh Tripathi account to DEV role`);
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({
            where: { email: u.email },
            data: updateData
          });
        }
      }
    }
  } catch (err) {
    console.error('Initial user check warning:', err);
  }
}

import { securityHeaders, globalApiLimiter, validateOrigin } from './middleware/security.js';

// Apply defensive security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
app.use(securityHeaders);

// Hardened CORS configuration
app.use(cors({
  origin: validateOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Apply global API rate limiter
app.use('/api', globalApiLimiter);

// Prevent caching of sensitive API data by proxies or shared browsers
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Octagram Internal Operations Hub API',
    version: '1.0.0'
  });
});

// Explicit robots.txt handler to prevent search engine crawler indexing
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /\n');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve static React client files in production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback for non-API client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`⚡ Octagram Hub API Server running on port: ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/health`);

  // Background non-blocking database warmup & initialization
  (async () => {
    try {
      await ensureInitialUsers();
    } catch (dbErr) {
      console.error('Initial database setup notice:', dbErr);
    }

    // Delayed automation engine startup
    setTimeout(() => {
      AutomationEngine.syncPaymentReminders().catch((err) =>
        console.error('Payment reminder sync warning:', err)
      );
      AutomationEngine.syncLeadFollowUps().catch((err) =>
        console.error('Lead followup sync warning:', err)
      );
    }, 4000);
  })();

  // Periodic automation interval every 5 minutes
  setInterval(() => {
    AutomationEngine.syncPaymentReminders().catch((err) =>
      console.error('Periodic payment reminder sync warning:', err)
    );
  }, 5 * 60 * 1000);
});
