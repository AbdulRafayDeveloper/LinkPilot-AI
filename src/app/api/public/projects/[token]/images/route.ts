import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { TASK_ATTACHMENT_MESSAGES, TASK_IMAGE_MAX_BYTES } from "@/constants/taskAttachments"
import { PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { storeTaskImage } from "@/services/taskImages"
import { publicProjectExists } from "@/services/clientProjects/publicTasks"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

/**
 * POST (body: the image itself): stores one image for an item the client is writing from a shared
 * project link, and answers `{ assetId, contentType, url }` the way `/api/task-images` does for a
 * signed-in page. It is the same storage service and the same ceiling; what differs is the key.
 *
 * **Nobody is signed in here, so the project's signed token is what is checked**, and it is checked
 * **before** a single byte is stored: a token that opens nothing stores nothing. That keeps the one
 * thing an open upload route has to be held to, which is the link, and it means the owner turning
 * the link off closes this door with the rest of them.
 *
 * Everything else is what makes any upload here safe: at most 4 MB (what a serverless function
 * takes), the type read from the bytes themselves rather than from what the browser calls it, and
 * the object's key built on the server from an id it makes, so nothing sent can point an upload at
 * another object or out of the prefix.
 *
 * It writes no record, so a repeat only leaves a copy nothing points at; the browser may safely
 * send it again, and nothing is on the project until an item is saved naming it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    if (!(await publicProjectExists(token))) {
      return NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })
    }
    if (Number(req.headers.get("content-length") ?? 0) > TASK_IMAGE_MAX_BYTES) {
      return NextResponse.json({ success: false, message: TASK_ATTACHMENT_MESSAGES.imageTooLarge }, { status: 413, headers: noStore })
    }
    const image = await storeTaskImage(Buffer.from(await req.arrayBuffer()))
    return NextResponse.json({ success: true, message: "Image stored", data: image }, { status: 201, headers: noStore })
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400, headers: noStore })
    }
    console.error("POST Public Project Image Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TASK_ATTACHMENT_MESSAGES.uploadFailed) }, { status: 400, headers: noStore })
  }
}
