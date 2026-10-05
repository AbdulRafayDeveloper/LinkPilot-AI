import mongoose, { Schema, type Model } from "mongoose"
import { BACKUP_STATUS_IDS, BACKUP_TRIGGER_IDS, type BackupStatus, type BackupTrigger } from "@/constants/backups"

/**
 * One database backup run, weekly or by hand: when it started and finished, whether it worked,
 * what it wrote (the file name, its key in the bucket, its size and how much it held) and, when it
 * didn't, why. Nothing in a backup's contents is recorded here, only the fact of it.
 *
 * It is a collection of its own, written for the first time by the first run, so no existing
 * record is read, changed or migrated by this module.
 */
export interface IBackupLog {
  status: BackupStatus
  trigger: BackupTrigger
  startedAt: Date
  finishedAt: Date | null
  fileName: string
  // The object's key in the bucket, or null when nothing reached it
  storageKey: string | null
  sizeBytes: number | null
  collections: number | null
  documents: number | null
  errorMessage: string | null
  // The admin's email for a run by hand; null for the weekly one, which nobody is signed in for
  startedBy: string | null
  createdAt: Date
  updatedAt: Date
}

const BackupLogSchema = new Schema<IBackupLog>(
  {
    status: { type: String, enum: BACKUP_STATUS_IDS, required: true },
    trigger: { type: String, enum: BACKUP_TRIGGER_IDS, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    fileName: { type: String, required: true },
    storageKey: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
    collections: { type: Number, default: null },
    documents: { type: Number, default: null },
    errorMessage: { type: String, default: null },
    startedBy: { type: String, default: null },
  },
  { timestamps: true, collection: "backup_logs" }
)
// Newest first for the list, and one status for its filter
BackupLogSchema.index({ createdAt: -1, _id: -1 })
BackupLogSchema.index({ status: 1, createdAt: -1 })

export const BackupLogModel =
  (mongoose.models.BackupLog as Model<IBackupLog> | undefined) ?? mongoose.model<IBackupLog>("BackupLog", BackupLogSchema)
