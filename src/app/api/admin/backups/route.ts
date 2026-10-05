import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BackupsQuerySchema } from "@/lib/validation/backups"
import { BACKUP_MESSAGES } from "@/constants/backups"
import { listBackups, runBackup } from "@/services/backup/backups"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
// Reading the whole database and sending it to storage takes as long as the database is large
export const maxDuration = 300

/**
 * GET (?page=&search=&status=&trigger=&from=&to=): Admin only. One page of backup records, newest
 * first, 50 to a page, with the counts over every record whatever the filters.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const parsed = BackupsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || BACKUP_MESSAGES.listFailed }, { status: 400 })
  }
  try {
    const page = await listBackups(parsed.data)
    return NextResponse.json({ success: true, message: "Backups retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Backups Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BACKUP_MESSAGES.listFailed) }, { status: 500 })
  }
}

/**
 * POST: Admin only. Backs the whole database up to the bucket now, exactly as the weekly schedule
 * does, and answers with the record of the run. A run that failed is still a record, so the answer
 * says what went wrong rather than only that something did.
 */
export async function POST() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const record = await runBackup({ trigger: "manual", startedBy: auth.viewer.email })
  if (!record) {
    return NextResponse.json({ success: false, message: BACKUP_MESSAGES.runFailed }, { status: 500 })
  }
  if (record.status === "failed") {
    return NextResponse.json({ success: false, message: record.errorMessage || BACKUP_MESSAGES.runFailed, data: record }, { status: 500 })
  }
  return NextResponse.json({ success: true, message: "Database backed up", data: record })
}
