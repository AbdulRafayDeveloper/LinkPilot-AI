import { NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { DUMMY_DATA_KIND_IDS, DUMMY_DATA_MESSAGES } from "@/constants/dummyData"
import { listDummyItems } from "@/services/dummyData"
import { requireViewer } from "@/services/auth/viewer"
import type { DummyDataGroup } from "@/types/dummyData"

export const dynamic = "force-dynamic"

/**
 * GET: every kind of sample data with its items, for the one page that now holds them all
 * (Administration → Dummy Data for Testing). Each kind is still read by the same service the
 * per-kind route uses, so there is one way to read them and the page needs one request rather
 * than one per kind.
 *
 * Admins only, like everything else about sample data: the per-kind routes check the role too.
 */
export async function GET() {
  const auth = await requireViewer({ role: "admin" })
  if (auth.denied) return auth.denied
  try {
    const groups: DummyDataGroup[] = await Promise.all(
      DUMMY_DATA_KIND_IDS.map(async (kind) => ({ kind, items: await listDummyItems(kind) }))
    )
    return NextResponse.json({ success: true, message: "Dummy data retrieved", data: groups })
  } catch (error: unknown) {
    console.error("GET All Dummy Data Exception:", error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, DUMMY_DATA_MESSAGES.loadFailed) },
      { status: 500 }
    )
  }
}
