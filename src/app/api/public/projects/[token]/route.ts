import { NextRequest, NextResponse } from "next/server"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { PublicProjectTaskSchema, PublicTaskDeleteSchema, PublicTaskEditSchema } from "@/lib/validation/clientProjectTasks"
import { readPublicProject } from "@/services/clientProjects/projects"
import { addPublicProjectTask, deletePublicProjectTask, updatePublicProjectTask } from "@/services/clientProjects/publicTasks"

export const dynamic = "force-dynamic"

/**
 * One client project, reachable without signing in (src/proxy.ts lets /api/public/ through), for
 * whoever the owner sent its link to. The signed token in the address is the only key, and it is
 * the whole of the caller's authority: it opens that one project and nothing else.
 *
 * **It reads and writes.** The client adds items, changes them, ticks them off and removes them,
 * because that is the point of the link: the work is theirs to describe. Every write goes through
 * `services/clientProjects/publicTasks.ts`, which resolves the project from the token afresh on
 * each call, so turning the link off or replacing it stops the writes at the same moment it stops
 * the reads. The item is named in the body, not the path, because the path carries the token (the
 * same shape an employee's plan link uses).
 *
 * It shows the project, the client's name and the items. It never says whose account it is, what
 * else that client has, or any id but each item's own.
 */

type RouteContext = { params: Promise<{ token: string }> }

const noStore = { "Cache-Control": "no-store" }

// Every refusal about the link reads the same, so a guessed token learns nothing
const invalidLink = () => NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404, headers: noStore })

const badRequest = (message: string) => NextResponse.json({ success: false, message }, { status: 400, headers: noStore })

/**
 * A write that got nowhere. A refusal about the **link** always reads the same, so a token that
 * opens nothing teaches nothing; an item that is gone says so, which only a caller already holding
 * a working token can see, and which is what a client needs to be told when the owner has just
 * deleted what they were editing.
 */
const writeFailed = (reason: "link" | "item") =>
  reason === "link" ? invalidLink() : NextResponse.json({ success: false, message: PROJECT_TASK_MESSAGES.taskNotFound }, { status: 404, headers: noStore })

/** The body as JSON, or null when there isn't any. */
const bodyOf = (req: NextRequest) => req.json().catch(() => null)

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  try {
    const project = await readPublicProject(token)
    if (!project) return invalidLink()
    return NextResponse.json({ success: true, message: "Project retrieved", data: project }, { headers: noStore })
  } catch (error: unknown) {
    console.error("GET Public Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PUBLIC_PROJECT_MESSAGES.invalid) }, { status: 500, headers: noStore })
  }
}

/**
 * POST: adds one item to the project, on the tab the body names (a change when it names none).
 *
 * Not wrapped in `withIdempotency`, which keys its answers per account and there is no account
 * here; the page sends it without a retry instead, so a dropped request is reported rather than
 * quietly adding the item twice.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const parsed = PublicProjectTaskSchema.safeParse(await bodyOf(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.saveFailed)
  try {
    const added = await addPublicProjectTask(token, parsed.data)
    return added.ok
      ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.created, data: added.value }, { status: 201, headers: noStore })
      : writeFailed(added.reason)
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return badRequest(error.message)
    console.error("POST Public Project Task Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.saveFailed) }, { status: 500, headers: noStore })
  }
}

/** PUT `{ taskId, ...fields }`: changes one item of that project. Only the fields sent are written. */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const parsed = PublicTaskEditSchema.safeParse(await bodyOf(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.saveFailed)
  const { taskId, ...input } = parsed.data
  try {
    const saved = await updatePublicProjectTask(token, taskId, input)
    return saved.ok ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.saved, data: saved.value }, { headers: noStore }) : writeFailed(saved.reason)
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return badRequest(error.message)
    console.error("PUT Public Project Task Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.saveFailed) }, { status: 500, headers: noStore })
  }
}

/** DELETE `{ taskId }`: removes one item of that project, with its images and its voice note. */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  const parsed = PublicTaskDeleteSchema.safeParse(await bodyOf(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || PROJECT_TASK_MESSAGES.deleteFailed)
  try {
    const removed = await deletePublicProjectTask(token, parsed.data.taskId)
    return removed.ok
      ? NextResponse.json({ success: true, message: PROJECT_TASK_MESSAGES.deleted, data: { deleted: 1 } }, { headers: noStore })
      : writeFailed(removed.reason)
  } catch (error: unknown) {
    console.error("DELETE Public Project Task Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PROJECT_TASK_MESSAGES.deleteFailed) }, { status: 500, headers: noStore })
  }
}
