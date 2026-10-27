import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { EntryCreateSchema } from "@/lib/validation/myProfile"
import { MY_PROFILE_MESSAGES } from "@/constants/profileSections"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"
import { runAiRequest } from "@/services/modelPriority"
import { createEntries, listEntries, profileStatusOf } from "@/services/myProfile/entries"
import { indexEntries } from "@/services/myProfile/vectors"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type RouteContext = { params: Promise<{ section: string }> }

/** GET: Every entry of one section of the asking person's own profile, in their order. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const entries = await listEntries(auth.viewer, (await params).section)
    return NextResponse.json({ success: true, message: "Entries read", data: { entries } })
  } catch (error: unknown) {
    console.error("GET My AI Profile section Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.loadFailed) }, { status: profileStatusOf(error) })
  }
}

/**
 * POST `{ fields }` (or `{ entries: [...] }` for several at once): adds to the top of the section,
 * then saves what was added for search. That second step never fails the save: an entry Gemini could
 * not take comes back marked, with the reason, and is tried again later.
 */
async function handlePost(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const body = EntryCreateSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ success: false, message: body.error.issues[0]?.message ?? MY_PROFILE_MESSAGES.saveFailed }, { status: 400 })
  try {
    const section = (await params).section
    const created = await createEntries(auth.viewer, section, "entries" in body.data ? body.data.entries : [body.data.fields])
    await runAiRequest(auth.viewer, "global-prompts", () => indexEntries(auth.viewer.id, created, req.signal))
    // Read back, so each entry says whether it is searchable now
    const saved = new Set(created.map((entry) => entry.id))
    const entries = (await listEntries(auth.viewer, section)).filter((entry) => saved.has(entry.id))
    return NextResponse.json({ success: true, message: MY_PROFILE_MESSAGES.saved, data: { entries } }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST My AI Profile entry Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MY_PROFILE_MESSAGES.saveFailed) }, { status: profileStatusOf(error) })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of adding the entry twice
export const POST = withIdempotency("my-profile", handlePost)
