import { NextResponse } from "next/server"
import { BACKUP_CONTENT_TYPE } from "@/constants/backups"
import { backupDownloadStream } from "@/services/backup/backups"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
// Reading the whole database out takes as long as the database is large
export const maxDuration = 300

/**
 * GET: Admin only. The whole database as one JSON file to download, written out as it is read, so
 * nothing is ever stored on the server and no amount of data is held in memory. The same bytes go
 * to the bucket in the same pass, and the run leaves a record either way; a storage problem is
 * recorded but never costs the download.
 */
export async function GET() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  const { fileName, body } = backupDownloadStream(auth.viewer.email)
  return new NextResponse(body, {
    headers: {
      "Content-Type": BACKUP_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  })
}
