import fs from 'fs';
import path from 'path';
import { getPersistentDbPath } from '../prisma.js';

export interface BackupInfo {
  filename: string;
  timestamp: string;
  sizeBytes: number;
  sizeFormatted: string;
  path: string;
}

export function getBackupsDirectory(): string {
  const dbPath = getPersistentDbPath();
  const dir = path.join(path.dirname(dbPath), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function createDatabaseBackup(customLabel?: string): BackupInfo | null {
  try {
    const dbPath = getPersistentDbPath();
    if (!fs.existsSync(dbPath)) {
      console.warn('Cannot backup database: database file does not exist at', dbPath);
      return null;
    }

    const backupsDir = getBackupsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const label = customLabel ? `-${customLabel.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
    const filename = `db-backup-${timestamp}${label}.db`;
    const targetFile = path.join(backupsDir, filename);

    fs.copyFileSync(dbPath, targetFile);
    const stats = fs.statSync(targetFile);

    const info: BackupInfo = {
      filename,
      timestamp: new Date().toISOString(),
      sizeBytes: stats.size,
      sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
      path: targetFile,
    };

    console.log(`💾 [Backup Service] Backup created successfully: ${filename} (${info.sizeFormatted})`);
    return info;
  } catch (err) {
    console.error('❌ [Backup Service] Error creating database backup:', err);
    return null;
  }
}

export function listDatabaseBackups(): BackupInfo[] {
  try {
    const backupsDir = getBackupsDirectory();
    if (!fs.existsSync(backupsDir)) return [];

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('db-backup-') && f.endsWith('.db'))
      .map(filename => {
        const filePath = path.join(backupsDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          timestamp: new Date(stats.mtime).toISOString(),
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          path: filePath,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return files;
  } catch (err) {
    console.error('❌ [Backup Service] Error listing backups:', err);
    return [];
  }
}
