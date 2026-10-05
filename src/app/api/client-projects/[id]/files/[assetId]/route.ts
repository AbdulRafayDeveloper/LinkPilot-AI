import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_FILE_CHUNK_BYTES, PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { RECORDING_STEP_BUDGET_MS } from "@/constants/meetingRecording"
import { ProjectFileChunkQuerySchema } from "@/lib/validation/clientProjectTasks"
import { finishProjectFile, storeProjectFileChunk } from "@/services/clientProjects/files"
import { projectOrNull } from "@/services/clientProjects/tasks"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"
// Joining reads chunks back and writes parts, so a step is given room the way a recording's is
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string; assetId: string }> }

const failed = (error: unknown, fallback: string) => {
  if (error instanceof UserFacingError) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  console.error("Client Project File Exception:", error instanceof Error ? error.message : error)
  return NextResponse.json({ success: false, message: toUserFacingMessage(error, fallback) }, { status: 500 })
}

/** The project, when the signed-in viewer may touch it. */
async function allowed(id: string) {
  const auth = await requireViewer()
  if (auth.denied) return { denied: auth.denied } as const
  const project = await projectOrNull(auth.viewer, id)
  return project ? ({ ok: true } as const) : ({ denied: NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.projectNotFound }, { status: 404 }) } as const)
}

/**
 * PUT (?index=, body: the chunk itself): takes one 4 MB piece of a file. The same chunk twice lands
 * on the same key, so a dropped request is safe to send again.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id, assetId } = await params
  const gate = await allowed(id)
  if ("denied" in gate) return gate.denied
  const parsed = ProjectFileChunkQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.fileChunkFailed }, { status: 400 })
  if (Number(req.headers.get("content-length") ?? 0) > PROJECT_FILE_CHUNK_BYTES) {
    return NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.fileChunkFailed }, { status: 413 })
  }
  try {
    const stored = await storeProjectFileChunk(id, assetId, parsed.data.index, Buffer.from(await req.arrayBuffer()))
    return NextResponse.json({ success: true, message: "Chunk stored", data: stored })
  } catch (error: unknown) {
    return failed(error, PROJECT_TASK_MESSAGES.fileChunkFailed)
  }
}

/**
 * POST: joins what has arrived into the finished file, as far as one step can, and answers where it
 * got to. The page calls it again while `done` is false, the way a recording's joining is driven.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id, assetId } = await params
  const gate = await allowed(id)
  if ("denied" in gate) return gate.denied
  try {
    const progress = await finishProjectFile(id, assetId, Date.now() + RECORDING_STEP_BUDGET_MS)
    return NextResponse.json({ success: true, message: progress.done ? "File ready" : "Joining", data: progress })
  } catch (error: unknown) {
    return failed(error, PROJECT_TASK_MESSAGES.fileUploadFailed)
  }
}
