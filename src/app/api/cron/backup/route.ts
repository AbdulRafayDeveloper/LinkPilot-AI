import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { env } from "@/config/env"
import { BACKUP_MESSAGES } from "@/constants/backups"
import { runBackup } from "@/services/backup/backups"

export const dynamic = "force-dynamic"
// The weekly run reads the whole database and sends it to storage
export const maxDuration = 300

/**
 * The weekly database backup. A serverless host keeps no process to hold a timer in, so the
 * schedule lives in vercel.json and Vercel Cron calls this route; `CRON_SECRET` is what tells its
 * call from anyone else's, since nobody is signed in for it. No other route is reachable this way:
 * the sign-in gate lets this one path through (src/proxy.ts) and it checks the secret itself.
 *
 * It answers 200 with the record of the attempt even when the backup failed, so the schedule is not
 * left retrying a run that has already been recorded; the reason is on the record and on the page.
 */
const isScheduled = (req: NextRequest): boolean => {
  const secret = env.CRON_SECRET
  if (!secret) return false
  const sent = Buffer.from(req.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return sent.length === expected.length && timingSafeEqual(sent, expected)
}

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    console.error("Scheduled backup refused: CRON_SECRET is not set")
    return NextResponse.json({ success: false, message: BACKUP_MESSAGES.cronSecretMissing }, { status: 503 })
  }
  if (!isScheduled(req)) {
    return NextResponse.json({ success: false, message: BACKUP_MESSAGES.cronRefused }, { status: 401 })
  }
  const record = await runBackup({ trigger: "weekly" })
  if (!record) {
    return NextResponse.json({ success: false, message: BACKUP_MESSAGES.runFailed }, { status: 500 })
  }
  return NextResponse.json({ success: true, message: `Weekly backup ${record.status}`, data: record })
}
