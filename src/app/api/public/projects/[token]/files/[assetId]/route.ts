import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_FILE_CHUNK_BYTES, PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { RECORDING_STEP_BUDGET_MS } from "@/constants/meetingRecording"
import { ProjectFileChunkQuerySchema } from "@/lib/validation/clientProjectTasks"
import { finishProjectFile, storeProjectFileChunk } from "@/services/clientProjects/files"
import { projectFromToken } from "@/services/clientProjects/projects"

export const dynamic = "force-dynamic"
// Joining reads chunks back and writes parts, so a step is given room the way a recording's is
export const maxDuration = 60

type RouteContext = { params: Promise<{ token: string; assetId: string }> }

const noStore = { "Cache-Control": "no-store" }
const invalidLink = () => NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })

const failed = (error: unknown, fallback: string) => {
  if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400, headers: noStore })
  console.error("Public Project File Exception:", error instanceof Error ? error.message : error)
  return NextResponse.json({ success: false, message: toUserFacingMessage(error, fallback) }, { status: 500, headers: noStore })
}

/**
 * The chunks of a file a client is attaching from a shared link, and the joining of them.
 *
 * **The token is resolved afresh on every call**, so the owner turning the link off stops an upload
 * part way through as surely as it stops a read, and the project it names is the only one these
 * chunks can ever belong to: `storeProjectFileChunk` and `finishProjectFile` are both given that
 * project's id, and an `assetId` from another project matches nothing.
 */
async function projectIdOf(token: string): Promise<string | null> {
  const project = await projectFromToken(token)
  return project ? project._id.toString() : null
}

/** PUT (?index=, body: the chunk itself): takes one 4 MB piece. The same chunk twice is harmless. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { token, assetId } = await params
  const parsed = ProjectFileChunkQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.fileChunkFailed }, { status: 400, headers: noStore })
  if (Number(req.headers.get("content-length") ?? 0) > PROJECT_FILE_CHUNK_BYTES) {
    return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.fileChunkFailed }, { status: 413, headers: noStore })
  }
  try {
    const projectId = await projectIdOf(token)
    if (!projectId) return invalidLink()
    const stored = await storeProjectFileChunk(projectId, assetId, parsed.data.index, Buffer.from(await req.arrayBuffer()))
    return NextResponse.json({ success: true, message: "Chunk stored", data: stored }, { headers: noStore })
  } catch (error: unknown) {
    return failed(error, PROJECT_TASK_MESSAGES.fileChunkFailed)
  }
}

/** POST: joins what has arrived, as far as one step can. The page calls again while `done` is false. */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { token, assetId } = await params
  try {
    const projectId = await projectIdOf(token)
    if (!projectId) return invalidLink()
    const progress = await finishProjectFile(projectId, assetId, Date.now() + RECORDING_STEP_BUDGET_MS)
    return NextResponse.json({ success: true, message: progress.done ? "File ready" : "Joining", data: progress }, { headers: noStore })
  } catch (error: unknown) {
    return failed(error, PROJECT_TASK_MESSAGES.fileUploadFailed)
  }
}
