import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ChunkQuerySchema, chunkSizeIssue } from "@/lib/validation/meetingRecording"
import { RECORDING_CHUNK_MAX_BYTES, RECORDING_MESSAGES } from "@/constants/meetingRecording"
import { MEETING_MESSAGES } from "@/constants/meetings"
import { storeChunk } from "@/services/meetings/recording"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

// A refusal the browser should act on, rather than a server fault
const STATUS_FOR: Record<string, number> = {
  [RECORDING_MESSAGES.notRecording]: 409,
  [RECORDING_MESSAGES.chunkMissing]: 400,
  [RECORDING_MESSAGES.chunkTooLarge]: 413,
}

/**
 * PUT (?track=&index=&startMs=, the body is the chunk's bytes): keeps one chunk of a recording. A chunk
 * is at most 4 MB, so it fits Vercel's 4.5 MB request body limit, and it is refused before it is read
 * when it says it is larger. The same chunk sent twice lands on the same key, so a retry is harmless.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const query = ChunkQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ success: false, message: query.error.issues[0]?.message || RECORDING_MESSAGES.chunkMissing }, { status: 400 })
  // A body announced as too large is refused without reading it
  const announced = Number(req.headers.get("content-length") ?? "0")
  if (announced > RECORDING_CHUNK_MAX_BYTES) return NextResponse.json({ success: false, message: RECORDING_MESSAGES.chunkTooLarge }, { status: 413 })
  try {
    const bytes = Buffer.from(await req.arrayBuffer())
    const issue = chunkSizeIssue(bytes.length)
    if (issue) return NextResponse.json({ success: false, message: issue }, { status: STATUS_FOR[issue] })
    const stored = await storeChunk(auth.viewer, (await params).id, query.data, bytes)
    if (!stored) return NextResponse.json({ success: false, message: MEETING_MESSAGES.notFound }, { status: 404 })
    return NextResponse.json({ success: true, message: "Chunk kept", data: { size: bytes.length } })
  } catch (error: unknown) {
    const status = error instanceof UserFacingError ? (STATUS_FOR[error.message] ?? 500) : 500
    if (status === 500) console.error("PUT Recording Chunk Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, RECORDING_MESSAGES.uploadRetrying) }, { status })
  }
}
