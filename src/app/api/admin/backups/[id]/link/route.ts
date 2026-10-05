import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { BACKUP_MESSAGES } from "@/constants/backups"
import { linkToBackup } from "@/services/backup/backups"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * GET: Admin only. A short-lived link that downloads one stored backup file. The bucket stays
 * private and the key never leaves the server, exactly as every other stored file works here.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const { id } = await params
  try {
    const url = await linkToBackup(id)
    if (!url) return NextResponse.json({ success: false, message: BACKUP_MESSAGES.noFile }, { status: 404 })
    return NextResponse.json({ success: true, message: "Backup link created", data: { url } })
  } catch (error: unknown) {
    console.error("GET Backup Link Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, BACKUP_MESSAGES.linkFailed) }, { status: 500 })
  }
}
