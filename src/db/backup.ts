/**
 * Database Backup Module
 *
 * Provides backup and restore functionality for SQLite database.
 * Supports:
 * - Manual and automated backups
 * - Backup retention (pruning old backups)
 * - Point-in-time restore
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync } from "fs";
import { join, basename } from "path";
import { getDb, closeDb } from "./index.js";

const DEFAULT_BACKUP_DIR = "./backups";
const DEFAULT_RETENTION_DAYS = 30;

export interface BackupOptions {
  backupDir?: string;
  prefix?: string;
}

export interface BackupResult {
  success: boolean;
  path?: string;
  error?: string;
  timestamp?: string;
  sizeBytes?: number;
}

export interface BackupInfo {
  filename: string;
  path: string;
  timestamp: Date;
  sizeBytes: number;
  ageInDays: number;
}

/**
 * Creates a backup of the database
 *
 * @param dbPath - Path to the SQLite database file
 * @param options - Backup options
 * @returns BackupResult with the backup file path
 */
export function createBackup(
  dbPath: string = "oa.db",
  options: BackupOptions = {}
): BackupResult {
  const { backupDir = DEFAULT_BACKUP_DIR, prefix = "oa-backup" } = options;

  try {
    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Check if source database exists
    if (!existsSync(dbPath)) {
      return {
        success: false,
        error: `Database file not found: ${dbPath}`,
      };
    }

    // Generate timestamp-based filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const backupFilename = `${prefix}-${timestamp}.db`;
    const backupPath = join(backupDir, backupFilename);

    // Use SQLite's backup API through better-sqlite3
    // This creates a consistent backup even if the DB is in use
    const db = getDb();
    db.backup(backupPath)
      .then(() => {
        console.log(`[BACKUP] Database backed up to ${backupPath}`);
      })
      .catch((err) => {
        console.error(`[BACKUP] Failed to backup database: ${err.message}`);
      });

    // For synchronous backup, use file copy (WAL mode ensures consistency)
    // Note: This is a fallback if async backup isn't suitable
    copyFileSync(dbPath, backupPath);

    // Also backup WAL and SHM files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (existsSync(walPath)) {
      copyFileSync(walPath, `${backupPath}-wal`);
    }
    if (existsSync(shmPath)) {
      copyFileSync(shmPath, `${backupPath}-shm`);
    }

    const stats = statSync(backupPath);

    return {
      success: true,
      path: backupPath,
      timestamp: now.toISOString(),
      sizeBytes: stats.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to create backup: ${message}`,
    };
  }
}

/**
 * Restores the database from a backup file
 *
 * WARNING: This will overwrite the current database!
 *
 * @param backupPath - Path to the backup file
 * @param dbPath - Path to the target database file
 * @returns BackupResult indicating success or failure
 */
export function restoreBackup(
  backupPath: string,
  dbPath: string = "oa.db"
): BackupResult {
  try {
    if (!existsSync(backupPath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupPath}`,
      };
    }

    // Close the current database connection
    closeDb();

    // Copy backup to database path
    copyFileSync(backupPath, dbPath);

    // Also restore WAL and SHM files if they exist in backup
    const walBackup = `${backupPath}-wal`;
    const shmBackup = `${backupPath}-shm`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    if (existsSync(walBackup)) {
      copyFileSync(walBackup, walPath);
    } else if (existsSync(walPath)) {
      // Remove existing WAL if backup doesn't have one
      unlinkSync(walPath);
    }

    if (existsSync(shmBackup)) {
      copyFileSync(shmBackup, shmPath);
    } else if (existsSync(shmPath)) {
      // Remove existing SHM if backup doesn't have one
      unlinkSync(shmPath);
    }

    return {
      success: true,
      path: dbPath,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to restore backup: ${message}`,
    };
  }
}

/**
 * Lists all available backups
 *
 * @param backupDir - Directory containing backups
 * @param prefix - Backup file prefix to filter by
 * @returns Array of BackupInfo objects sorted by date (newest first)
 */
export function listBackups(
  backupDir: string = DEFAULT_BACKUP_DIR,
  prefix: string = "oa-backup"
): BackupInfo[] {
  if (!existsSync(backupDir)) {
    return [];
  }

  const now = new Date();
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".db") && !f.includes("-wal") && !f.includes("-shm"))
    .map((filename) => {
      const path = join(backupDir, filename);
      const stats = statSync(path);
      const timestamp = extractTimestamp(filename, prefix);

      return {
        filename,
        path,
        timestamp,
        sizeBytes: stats.size,
        ageInDays: Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24)),
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return files;
}

/**
 * Removes backups older than the specified number of days
 *
 * @param backupDir - Directory containing backups
 * @param keepDays - Number of days to keep backups (default: 30)
 * @param prefix - Backup file prefix to filter by
 * @returns Number of backups deleted
 */
export function pruneOldBackups(
  backupDir: string = DEFAULT_BACKUP_DIR,
  keepDays: number = DEFAULT_RETENTION_DAYS,
  prefix: string = "oa-backup"
): number {
  const backups = listBackups(backupDir, prefix);
  let deleted = 0;

  for (const backup of backups) {
    if (backup.ageInDays > keepDays) {
      try {
        unlinkSync(backup.path);
        // Also remove associated WAL/SHM files
        const walPath = `${backup.path}-wal`;
        const shmPath = `${backup.path}-shm`;
        if (existsSync(walPath)) unlinkSync(walPath);
        if (existsSync(shmPath)) unlinkSync(shmPath);
        deleted++;
        console.log(`[BACKUP] Pruned old backup: ${backup.filename} (${backup.ageInDays} days old)`);
      } catch (error) {
        console.error(`[BACKUP] Failed to delete ${backup.filename}:`, error);
      }
    }
  }

  return deleted;
}

/**
 * Gets information about the most recent backup
 */
export function getLatestBackup(
  backupDir: string = DEFAULT_BACKUP_DIR,
  prefix: string = "oa-backup"
): BackupInfo | null {
  const backups = listBackups(backupDir, prefix);
  return backups.length > 0 ? backups[0] : null;
}

/**
 * Extracts timestamp from backup filename
 */
function extractTimestamp(filename: string, prefix: string): Date {
  // Format: prefix-YYYY-MM-DDTHH-MM-SS-MMMZ.db
  const timestampPart = filename
    .replace(`${prefix}-`, "")
    .replace(".db", "")
    .replace(/-/g, (match, offset, string) => {
      // Replace date separators back to colons/dots
      if (offset === 4 || offset === 7) return "-"; // Date separators
      if (offset === 13 || offset === 16) return ":"; // Time separators
      if (offset === 19) return "."; // Millisecond separator
      return match;
    });

  try {
    return new Date(timestampPart);
  } catch {
    return new Date(0);
  }
}

/**
 * Performs a checkpoint on the WAL file to merge changes into main DB
 * Call this before backup for best consistency
 */
export function checkpointWal(): void {
  const db = getDb();
  db.pragma("wal_checkpoint(TRUNCATE)");
}

/**
 * Automated backup scheduler
 * Returns a function to stop the scheduler
 */
export function startBackupScheduler(
  dbPath: string = "oa.db",
  options: {
    backupDir?: string;
    intervalMs?: number;
    retentionDays?: number;
  } = {}
): () => void {
  const {
    backupDir = DEFAULT_BACKUP_DIR,
    intervalMs = 24 * 60 * 60 * 1000, // Default: daily
    retentionDays = DEFAULT_RETENTION_DAYS,
  } = options;

  const runBackup = () => {
    console.log("[BACKUP] Running scheduled backup...");

    // Checkpoint WAL before backup
    checkpointWal();

    // Create backup
    const result = createBackup(dbPath, { backupDir });
    if (result.success) {
      console.log(`[BACKUP] Scheduled backup completed: ${result.path}`);
    } else {
      console.error(`[BACKUP] Scheduled backup failed: ${result.error}`);
    }

    // Prune old backups
    const pruned = pruneOldBackups(backupDir, retentionDays);
    if (pruned > 0) {
      console.log(`[BACKUP] Pruned ${pruned} old backup(s)`);
    }
  };

  // Run immediately on start
  runBackup();

  // Schedule recurring backups
  const intervalId = setInterval(runBackup, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log("[BACKUP] Backup scheduler stopped");
  };
}
