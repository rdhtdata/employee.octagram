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

  let chosenPath = candidate1;
  if (fs.existsSync(candidate1)) {
    chosenPath = candidate1;
  } else if (fs.existsSync(candidate2)) {
    chosenPath = candidate2;
  } else if (fs.existsSync(candidate3)) {
    chosenPath = candidate3;
  } else if (fs.existsSync(candidate4)) {
    chosenPath = candidate4;
  } else if (fs.existsSync(candidate5)) {
    chosenPath = candidate5;
  } else {
    const parentDir = path.dirname(chosenPath);
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch (e) {
        console.warn('Could not create DB parent directory:', e);
      }
    }
  }

  console.log(`📦 Prisma connected to database at: ${chosenPath}`);
  return `file:${chosenPath}`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDbUrl(),
    },
  },
});
