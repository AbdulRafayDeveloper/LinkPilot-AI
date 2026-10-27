import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EntryOrderSchema } from "@/lib/validation/myProfile"
import { MY_PROFILE_MESSAGES } from "@/constants/profileSections"
import { requireViewer } from "@/services/auth/viewer"
import { profileStatusOf, reorderEntries } from "@/services/myProfile/entries"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ section: string }> }

/**
 * PUT `{ orderedIds }`: puts one section of the asking person's profile in the order given, which
 * must name every entry once (409 otherwise, and the page reads the list again). Changes no text,
 * so nothing is embedded again.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = EntryOrderSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ success: false, message: MY_PROFILE_MESSAGES.moveFailed }, { status: 400 })
  try {
    await reorderEntries(auth.viewer, (await params).section, body.data.orderedIds)
    return NextResponse.json({ success: true, message: MY_PROFILE_MESSAGES.saved, data: { orderedIds: body.data.orderedIds } })
  } catch (error: unknown) {
    console.error("PUT My AI Profile order Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.moveFailed) }, { status: profileStatusOf(error) })
  }
}
