import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EntryBodySchema } from "@/lib/validation/myProfile"
import { MY_PROFILE_MESSAGES } from "@/constants/profileSections"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest } from "@/services/modelPriority"
import { deleteEntry, listEntries, profileStatusOf, updateEntry } from "@/services/myProfile/entries"
import { deleteEntryVectors, indexEntries } from "@/services/myProfile/vectors"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type RouteContext = { params: Promise<{ section: string; id: string }> }

/**
 * PUT `{ fields }`: replaces one entry of the asking person's own profile, then saves it for search
 * again, but only when its text really changed, so an edit that changes nothing costs nothing.
 * Another person's entry, or one already gone, is a 404.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = EntryBodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ success: false, message: body.error.issues[0]?.message ?? MY_PROFILE_MESSAGES.saveFailed }, { status: 400 })
  try {
    const { section, id } = await params
    const entry = await updateEntry(auth.viewer, section, id, body.data.fields)
    if (!entry) return NextResponse.json({ success: false, message: MY_PROFILE_MESSAGES.notFound }, { status: 404 })
    await runAiRequest(auth.viewer, "global-prompts", () => indexEntries(auth.viewer.id, [entry], req.signal))
    const saved = (await listEntries(auth.viewer, section)).find((kept) => kept.id === entry.id) ?? entry
    return NextResponse.json({ success: true, message: MY_PROFILE_MESSAGES.saved, data: { entry: saved } })
  } catch (error: unknown) {
    console.error("PUT My AI Profile entry Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.saveFailed) }, { status: profileStatusOf(error) })
  }
}

/** DELETE: removes one entry of the asking person's own profile, with its vectors. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { section, id } = await params
    const removed = await deleteEntry(auth.viewer, section, id)
    if (!removed) return NextResponse.json({ success: false, message: MY_PROFILE_MESSAGES.notFound }, { status: 404 })
    await deleteEntryVectors(auth.viewer.id, [id])
    return NextResponse.json({ success: true, message: MY_PROFILE_MESSAGES.deleted, data: { deleted: 1 } })
  } catch (error: unknown) {
    console.error("DELETE My AI Profile entry Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.deleteFailed) }, { status: profileStatusOf(error) })
  }
}
