import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDbUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:') && !process.env.DATABASE_URL.includes('./')) {
    return process.env.DATABASE_URL;
  }

  // Potential SQLite paths in different execution environments
  const candidate1 = path.resolve(__dirname, '../prisma/dev.db');
  const candidate2 = path.resolve(process.cwd(), 'server/prisma/dev.db');
  const candidate3 = path.resolve(process.cwd(), 'prisma/dev.db');
  const candidate4 = path.resolve(__dirname, '../../server/prisma/dev.db');
  const candidate5 = path.resolve(process.cwd(), 'dev.db');

  const sourceDb = [candidate1, candidate2, candidate3, candidate4, candidate5].find((p) => fs.existsSync(p)) || candidate1;

  let targetDbPath = sourceDb;

  // In hosted environments, use writable directory
  const isHosted = sourceDb.includes('hbuilds') || process.env.NODE_ENV === 'production' || !!process.env.HOME;
  if (isHosted && process.env.HOME && process.env.HOME !== '/root') {
    try {
      const persistentDir = path.resolve(process.env.HOME, '.octagram_data');
      if (!fs.existsSync(persistentDir)) {
        fs.mkdirSync(persistentDir, { recursive: true });
      }
      const persistentDb = path.resolve(persistentDir, 'dev.db');
      
      // Clean any stale SQLite lock files from previous killed processes
      const staleLockFiles = [`${persistentDb}-journal`, `${persistentDb}-wal`, `${persistentDb}-shm`];
      for (const lockFile of staleLockFiles) {
        if (fs.existsSync(lockFile)) {
          try {
            fs.unlinkSync(lockFile);
            console.log(`🧹 Cleaned stale SQLite lock file: ${lockFile}`);
          } catch {}
        }
      }

      if (!fs.existsSync(persistentDb) && fs.existsSync(sourceDb)) {
        fs.copyFileSync(sourceDb, persistentDb);
        console.log(`📋 Copied seed database to persistent storage: ${persistentDb}`);
      }
      if (fs.existsSync(persistentDb)) {
        targetDbPath = persistentDb;
      }
    } catch (err) {
      console.warn('Persistent directory notice, using source path:', err);
    }
  }

  const parentDir = path.dirname(targetDbPath);
  if (!fs.existsSync(parentDir)) {
    try {
      fs.mkdirSync(parentDir, { recursive: true });
    } catch (e) {
      console.warn('Could not create DB parent directory:', e);
    }
  }

  console.log(`📦 Prisma database path: ${targetDbPath}`);
  return `file:${targetDbPath}?connection_limit=1`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDbUrl(),
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

export async function connectDatabase(): Promise<boolean> {
  try {
    const start = Date.now();
    await prisma.$connect();
    // Verify fast query execution
    await prisma.$queryRawUnsafe('SELECT 1;');
    console.log(`⚡ Prisma connected and verified database in ${Date.now() - start}ms`);
    return true;
  } catch (err) {
    console.error('❌ Prisma database connection error:', err);
    return false;
  }
}
