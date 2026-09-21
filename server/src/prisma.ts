import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDbUrl(): string {
  let url = process.env.DATABASE_URL;

  if (!url || !url.startsWith('file:') || url.includes('./')) {
    // Locate the actual SQLite database file generated during build
    const candidate1 = path.resolve(__dirname, '../prisma/dev.db');
    const candidate2 = path.resolve(process.cwd(), 'server/prisma/dev.db');
    const candidate3 = path.resolve(process.cwd(), 'prisma/dev.db');
    const candidate4 = path.resolve(__dirname, '../../server/prisma/dev.db');
    const candidate5 = path.resolve(process.cwd(), 'dev.db');

    const targetDbPath = [candidate1, candidate2, candidate3, candidate4, candidate5].find((p) => fs.existsSync(p)) || candidate1;

    const parentDir = path.dirname(targetDbPath);
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch (e) {
        console.warn('Could not create DB parent directory:', e);
      }
    }

    url = `file:${targetDbPath}`;
  }

  // Critical for SQLite on multi-core servers and Hostinger shared hosting:
  // 1. connection_limit=1 avoids Prisma connection pool deadlocks on single-file SQLite DBs
  // 2. timeout=10000 ensures queries wait for locks without timing out or crashing
  if (!url.includes('connection_limit=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}connection_limit=1&timeout=10000`;
  }

  console.log(`📦 Prisma database target URL: ${url}`);
  return url;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDbUrl(),
    },
  },
  log: ['info', 'warn', 'error'],
});

export async function connectDatabase(): Promise<boolean> {
  try {
    const start = Date.now();
    await prisma.$connect();
    // Configure SQLite for high-stability on shared hosting (CloudLinux/CageFS)
    // 1. busy_timeout = 5000ms: wait gracefully for any brief write locks
    // 2. synchronous = NORMAL: safe and performant disk syncing
    // 3. journal_mode = TRUNCATE: avoids POSIX shared-memory (.db-shm) lock hangs on shared hosting filesystems
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    try {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = TRUNCATE;');
    } catch (jErr) {
      console.warn('SQLite journal mode fallback notice:', jErr);
    }

    console.log(`⚡ Prisma connected (SQLite Journal Mode: TRUNCATE, Busy Timeout: 5000ms) in ${Date.now() - start}ms`);
    return true;
  } catch (err) {
    console.error('❌ Prisma database connection error:', err);
    return false;
  }
}
