/**
 * Database Pre-Flight and Persistence Manager
 * Ensures SQLite database files are stored in a persistent directory outside
 * the ephemeral Git deployment directory, takes automated backups before schema
 * updates, and hydrates initial data if starting for the first time.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveDatabasePath() {
  // 1. Explicit DATABASE_URL (if absolute file path)
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

  // 3. Production or Linux / Hostinger environment -> Persistent home directory
  const isProduction = process.env.NODE_ENV === 'production' || process.platform === 'linux';
  if (isProduction) {
    const prodDb = path.join(os.homedir(), '.octagram_data', 'production.db');
    const devDbInHome = path.join(os.homedir(), '.octagram_data', 'dev.db');
    if (fs.existsSync(prodDb)) return prodDb;
    if (fs.existsSync(devDbInHome)) return devDbInHome;
    return prodDb;
  }

  // 4. Local Development fallback (inside repository)
  const repoDevDb = path.resolve(__dirname, '../prisma/dev.db');
  return repoDevDb;
}

export function prepareDatabase() {
  let targetDbPath = resolveDatabasePath();
  let dbDir = path.dirname(targetDbPath);
  let backupsDir = path.join(dbDir, 'backups');

  // 1. Ensure target data and backup directories exist (with safe permission fallback)
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`📁 [Octagram DB Guard] Created persistent database directory: ${dbDir}`);
    }
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
  } catch (dirErr) {
    console.warn(`⚠️ [Octagram DB Guard] Could not access ${dbDir} (${dirErr.message}). Falling back to workspace storage.`);
    targetDbPath = path.resolve(__dirname, '../prisma/dev.db');
    dbDir = path.dirname(targetDbPath);
    backupsDir = path.join(dbDir, 'backups');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  }

  console.log(`\n🔒 [Octagram DB Guard] Active Database Path: ${targetDbPath}`);

  // 2. If target database already exists, create a pre-deploy safety backup
  if (fs.existsSync(targetDbPath)) {
    const stats = fs.statSync(targetDbPath);
    if (stats.size > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupsDir, `db-backup-${timestamp}.db`);
      fs.copyFileSync(targetDbPath, backupFile);
      console.log(`💾 [Octagram DB Guard] Created pre-deploy backup snapshot: ${backupFile} (${(stats.size / 1024).toFixed(1)} KB)`);

      // Keep only last 10 backups to prevent disk bloat
      try {
        const files = fs.readdirSync(backupsDir)
          .filter(f => f.startsWith('db-backup-') && f.endsWith('.db'))
          .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);

        if (files.length > 10) {
          files.slice(10).forEach(f => {
            fs.unlinkSync(path.join(backupsDir, f.name));
          });
        }
      } catch (cleanErr) {
        console.warn('⚠️ [Octagram DB Guard] Notice cleaning old backups:', cleanErr.message);
      }
    }
  } else {
    // 3. Target database does not exist yet (first-time setup or newly moved to persistent storage)
    // Attempt to hydrate from existing repo database if present
    const seedCandidates = [
      path.resolve(__dirname, '../prisma/dev.db'),
      path.resolve(process.cwd(), 'server/prisma/dev.db'),
      path.resolve(process.cwd(), 'prisma/dev.db'),
      path.resolve(__dirname, '../../server/prisma/dev.db'),
    ];

    const sourceDb = seedCandidates.find(p => fs.existsSync(p) && fs.statSync(p).size > 0);
    if (sourceDb && sourceDb !== targetDbPath) {
      fs.copyFileSync(sourceDb, targetDbPath);
      console.log(`🌱 [Octagram DB Guard] Hydrated persistent database from base data: ${sourceDb} -> ${targetDbPath}`);
    } else {
      console.log(`✨ [Octagram DB Guard] Initializing new persistent database at: ${targetDbPath}`);
    }
  }

  // Set formatted DATABASE_URL in environment for subsequent Prisma commands
  const formattedUrl = `file:${targetDbPath}?connection_limit=1&timeout=10000`;
  process.env.DATABASE_URL = formattedUrl;
  console.log(`✅ [Octagram DB Guard] Database environment prepared.\n`);
  return targetDbPath;
}

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareDatabase();
}
