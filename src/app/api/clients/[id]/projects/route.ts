import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { ClientProjectSchema } from "@/lib/validation/clientProject"
import { CLIENTS_MESSAGES, CLIENT_PROJECT_MESSAGES } from "@/constants/clients"
import { createClientProject, listClientProjects } from "@/services/clients/projects"
import { requireViewer } from "@/services/auth/viewer"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

// A client the viewer may not see answers as no client, so a project is never reachable through it
const noClient = () => NextResponse.json({ success: false, message: CLIENTS_MESSAGES.notFound }, { status: 404 })

/** GET: One client's projects, newest first, with the active and completed counts. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const page = await listClientProjects(auth.viewer, (await params).id)
    return page ? NextResponse.json({ success: true, message: "Projects retrieved", data: page }) : noClient()
  } catch (error: unknown) {
    console.error("GET Client Projects Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_PROJECT_MESSAGES.loadFailed) }, { status: 500 })
  }
}

/** POST (body: { name, description?, status? }): Adds a project to this client. */
async function handlePost(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientProjectSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_PROJECT_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const project = await createClientProject(auth.viewer, (await params).id, parsed.data)
    return project
      ? NextResponse.json({ success: true, message: CLIENT_PROJECT_MESSAGES.created, data: project }, { status: 201 })
      : noClient()
  } catch (error: unknown) {
    // The client is full: the caller's to fix, not a failure of the module
    if (error instanceof UserFacingError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    console.error("POST Client Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_PROJECT_MESSAGES.saveFailed) }, { status: 500 })
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of adding two
export const POST = withIdempotency("clients:projects", handlePost)
