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

  console.log(`📦 Prisma connected to database at: ${targetDbPath}`);
  return `file:${targetDbPath}`;
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
    console.log(`⚡ Prisma connected and initialized in ${Date.now() - start}ms`);
    return true;
  } catch (err) {
    console.error('❌ Prisma database connection error:', err);
    return false;
  }
}
