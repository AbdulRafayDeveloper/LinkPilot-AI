/**
 * Database Backup, the admin area's fourth page. Once a week the whole database is written out as
 * Extended JSON and put in the same S3 bucket the rest of the app stores files in, and every run
 * leaves a record saying whether it worked. The same flow runs on demand from the page, where it
 * also streams the dump to the browser as a file to keep.
 *
 * Nothing here holds a credential: the bucket comes from the AWS variables (services/storage/s3.ts)
 * and the weekly run is let in by CRON_SECRET, both read on the server only.
 */

export const BACKUPS_HREF = "/admin/backups"
export const BACKUPS_ENDPOINT = "/api/admin/backups"
// The manual run: streams the dump to the browser, puts the same bytes in the bucket, records both
export const BACKUP_EXPORT_ENDPOINT = "/api/admin/backups/export"
// What Vercel Cron calls; it is let through the sign-in gate and checks CRON_SECRET itself
export const CRON_BACKUP_PATH = "/api/cron/backup"

/**
 * Every Monday at 03:00 UTC. It lives here and in vercel.json, which is what actually schedules it:
 * a serverless host has no process to keep a timer in, so Vercel Cron calls the route instead.
 */
export const BACKUP_SCHEDULE = "0 3 * * 1"
export const BACKUP_SCHEDULE_LABEL = "Every Monday at 03:00 UTC"

export const BACKUP_STATUSES = [
  { id: "success", label: "Succeeded" },
  { id: "failed", label: "Failed" },
] as const
export type BackupStatus = (typeof BACKUP_STATUSES)[number]["id"]
export const BACKUP_STATUS_IDS = BACKUP_STATUSES.map((status) => status.id) as [BackupStatus, ...BackupStatus[]]

export const BACKUP_TRIGGERS = [
  { id: "weekly", label: "Weekly schedule" },
  { id: "manual", label: "Run by hand" },
] as const
export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number]["id"]
export const BACKUP_TRIGGER_IDS = BACKUP_TRIGGERS.map((trigger) => trigger.id) as [BackupTrigger, ...BackupTrigger[]]

export const backupStatusLabel = (id: BackupStatus) => BACKUP_STATUSES.find((status) => status.id === id)?.label ?? id
export const backupTriggerLabel = (id: BackupTrigger) => BACKUP_TRIGGERS.find((trigger) => trigger.id === id)?.label ?? id

// Where a backup file lives in the bucket, beside the app's other folders
export const BACKUP_STORAGE_PREFIX = "LinkPilot/backups"
export const BACKUP_CONTENT_TYPE = "application/json"

// Documents read from one collection at a time, so a large collection never arrives whole
export const BACKUP_BATCH_SIZE = 500
// Extra attempts at the upload after the first, with exponential backoff and jitter (lib/retry.ts)
export const BACKUP_UPLOAD_RETRIES = 2
// The most of a failure's text kept on the record, so a stack trace never becomes the log
export const BACKUP_ERROR_MAX_LENGTH = 600

export const BACKUP_MESSAGES = {
  listFailed: "Couldn't load the backups. Please try again.",
  runFailed: "Couldn't back the database up. The reason is on the newest record.",
  exportFailed: "Couldn't export the database. Please try again.",
  linkFailed: "Couldn't open that backup file. Please try again.",
  notFound: "That backup no longer exists.",
  noFile: "This backup has no file in storage.",
  storageUnavailable: "File storage isn't configured here, so a backup can't be kept in the cloud. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET_NAME.",
  cronSecretMissing: "The weekly backup needs CRON_SECRET to be set where the app runs.",
  cronRefused: "That isn't the scheduled backup.",
  running: "Backing the database up and preparing your download...",
  exportHint: "Downloads the whole database as one JSON file and keeps a copy in the cloud. Nothing is stored on the server.",
} as const
