import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

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
const PORT = process.env.PORT || 5001;

async function ensureInitialUsers() {
  try {
    const adminPasswordHash = await bcrypt.hash('zidane123', 10);
    const salesPasswordHash = await bcrypt.hash('octagram123', 10);

    const initialUsers = [
      {
        email: 'harsh@octagramai.com',
        name: 'Harsh Tripathi',
        role: 'ADMIN',
        department: 'Leadership & Operations',
        passwordHash: adminPasswordHash,
      },
      {
        email: 'vishnu@octagramai.com',
        name: 'Vishnu',
        role: 'ADMIN',
        department: 'Leadership & Operations',
        passwordHash: adminPasswordHash,
      },
      {
        email: 'sanjana@octagramai.com',
        name: 'Sanjana',
        role: 'ADMIN',
        department: 'Leadership & Operations',
        passwordHash: adminPasswordHash,
      },
      {
        email: 'sumaiya@octagramai.com',
        name: 'Sumaiya',
        role: 'SALES',
        department: 'Sales & Outreach',
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
            passwordHash: u.passwordHash,
            isActive: true,
          }
        });
        console.log(`👤 Created initial user account: ${u.email}`);
      }
    }
  } catch (err) {
    console.error('Initial user check warning:', err);
  }
}

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Octagram Internal Operations Hub API',
    version: '1.0.0'
  });
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

app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`⚡ Octagram Hub API Server running on port ${PORT} (0.0.0.0)`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/health`);

  // Ensure initial authorized accounts exist
  await ensureInitialUsers();

  // Run initial background automation sync
  AutomationEngine.syncPaymentReminders().catch((err) =>
    console.error('Initial payment reminder sync failed:', err)
  );
  AutomationEngine.syncLeadFollowUps().catch((err) =>
    console.error('Initial lead followup sync failed:', err)
  );

  // Periodic automation interval every 5 minutes
  setInterval(() => {
    AutomationEngine.syncPaymentReminders().catch((err) =>
      console.error('Periodic payment reminder sync failed:', err)
    );
  }, 5 * 60 * 1000);
});
