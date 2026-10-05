import type { BackupStatus, BackupTrigger } from "@/constants/backups"

/** One backup run, as the admin page lists it. Never names a bucket, a key's credentials or an account id. */
export interface BackupLogEntry {
  id: string
  createdAt: string
  finishedAt: string | null
  status: BackupStatus
  trigger: BackupTrigger
  // The file name the dump was stored and downloaded under
  fileName: string
  // Null when nothing reached the cloud (storage off, or the upload failed)
  hasFile: boolean
  sizeBytes: number | null
  collections: number | null
  documents: number | null
  durationMs: number | null
  errorMessage: string | null
  // The admin who ran it by hand; null for the weekly run
  startedBy: string | null
}

export interface BackupSummary {
  total: number
  succeeded: number
  failed: number
  lastSuccessAt: string | null
}

export interface BackupsPage {
  items: BackupLogEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // Covers every record whatever the filters, and comes with every page
  summary: BackupSummary
}

/** What one backup run produced, before it becomes a record. */
export interface BackupOutcome {
  fileName: string
  storageKey: string | null
  sizeBytes: number
  collections: number
  documents: number
}
