import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientProjectSchema } from "@/lib/validation/clientProject"
import { CLIENT_PROJECT_MESSAGES } from "@/constants/clients"
import { deleteClientProject, updateClientProject } from "@/services/clients/projects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string; projectId: string }> }

// A project of another account, of another client, or an id that isn't one, all read as not found
const notFound = () => NextResponse.json({ success: false, message: CLIENT_PROJECT_MESSAGES.notFound }, { status: 404 })

/** PUT (body: { name, description?, status? }): Replaces one project of this client. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientProjectSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || CLIENT_PROJECT_MESSAGES.saveFailed }, { status: 400 })
  }
  try {
    const { id, projectId } = await params
    const project = await updateClientProject(auth.viewer, id, projectId, parsed.data)
    return project ? NextResponse.json({ success: true, message: CLIENT_PROJECT_MESSAGES.saved, data: project }) : notFound()
  } catch (error: unknown) {
    console.error("PUT Client Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_PROJECT_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/** DELETE: Removes one project. The client and their messages stay as they are. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { id, projectId } = await params
    const removed = await deleteClientProject(auth.viewer, id, projectId)
    return removed ? NextResponse.json({ success: true, message: CLIENT_PROJECT_MESSAGES.deleted, data: { deleted: 1 } }) : notFound()
  } catch (error: unknown) {
    console.error("DELETE Client Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_PROJECT_MESSAGES.deleteFailed) }, { status: 500 })
  }
}
