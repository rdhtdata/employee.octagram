import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure absolute path to dev.db so it resolves identically whether started from root or server
const defaultDbPath = path.resolve(__dirname, '../../prisma/dev.db');
const dbUrl = process.env.DATABASE_URL || `file:${defaultDbPath}`;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
