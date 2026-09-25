import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import os from 'os';

export function getPersistentDbPath(): string {
  // 1. Explicit DATABASE_URL if absolute file path provided
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('file:')) {
    const rawPath = envUrl.replace(/^file:/, '').split('?')[0];
    if (path.isAbsolute(rawPath)) {
      return rawPath;
    }
  }

  // 2. Explicit custom data directory
  if (process.env.OCTAGRAM_DATA_DIR) {
    return path.resolve(process.env.OCTAGRAM_DATA_DIR, 'production.db');
  }

  // 3. Production or Linux / Hostinger environment -> Persistent home directory (~/.octagram_data/)
  const isProduction = process.env.NODE_ENV === 'production' || process.platform === 'linux';
  if (isProduction) {
    try {
      const prodDir = path.join(os.homedir(), '.octagram_data');
      if (!fs.existsSync(prodDir)) {
        fs.mkdirSync(prodDir, { recursive: true });
      }
      const prodDb = path.join(prodDir, 'production.db');
      const devDbInHome = path.join(prodDir, 'dev.db');
      if (fs.existsSync(prodDb)) return prodDb;
      if (fs.existsSync(devDbInHome)) return devDbInHome;
      return prodDb;
    } catch (e) {
      console.warn('Persistent home directory inaccessible, falling back to local storage:', e);
    }
  }

  // 4. Local Development: check repo locations
  const candidate1 = path.resolve(__dirname, '../prisma/dev.db');
  const candidate2 = path.resolve(process.cwd(), 'server/prisma/dev.db');
  const candidate3 = path.resolve(process.cwd(), 'prisma/dev.db');
  const candidate4 = path.resolve(__dirname, '../../server/prisma/dev.db');
  const candidate5 = path.resolve(process.cwd(), 'dev.db');

  return [candidate1, candidate2, candidate3, candidate4, candidate5].find((p) => fs.existsSync(p)) || candidate1;
}

export function getDbUrl(): string {
  let url = process.env.DATABASE_URL;

  if (url && url.startsWith('file:') && !url.includes('./')) {
    // Custom absolute SQLite path provided - ensure parent directory exists
    const cleanPath = url.replace('file:', '').split('?')[0];
    const parentDir = path.dirname(cleanPath);
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch (e) {
        console.warn('Could not create custom DB parent directory:', e);
      }
    }
  } else if (!url || !url.startsWith('file:') || url.includes('./')) {
    let targetDbPath = getPersistentDbPath();
    let parentDir = path.dirname(targetDbPath);
    try {
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
    } catch (e) {
      targetDbPath = path.resolve(__dirname, '../prisma/dev.db');
      parentDir = path.dirname(targetDbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
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
