import { NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { dayBoundParam } from "@/lib/validation/listFilters"
import { countComments } from "@/services/commentWriter/commentCount"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

// The start of the viewer's own day, so "today" is their today and not the server's
const CountQuerySchema = z.object({ from: dayBoundParam })

/**
 * GET: how many comments this account has written today and in all, for the reminder on the page.
 */
export async function GET(request: Request) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const query = CountQuerySchema.safeParse({ from: new URL(request.url).searchParams.get("from") })
  if (!query.success) {
    return NextResponse.json({ success: false, message: query.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  try {
    const since = query.data.from ? new Date(query.data.from) : new Date(new Date().toISOString().slice(0, 10))
    const count = await countComments(auth.viewer, since)
    return NextResponse.json({ success: true, message: "Comment count retrieved", data: count })
  } catch (error: unknown) {
    console.error("GET Comment Count Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, "Failed to load your comment count") }, { status: 500 })
  }
}
