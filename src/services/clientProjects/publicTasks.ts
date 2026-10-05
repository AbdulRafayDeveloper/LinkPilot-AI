import { changeProjectTask, createProjectTask, removeProjectTask, taskById } from "./tasks"
import { projectFromToken } from "./projects"
import type { ProjectTask, ProjectTaskInput } from "@/types/clientProjectTasks"

/**
 * What someone holding a project's shared link may write. They are signed in to nothing, so the
 * signed token in the address is the whole of their authority, and these functions are the only way
 * a write can arrive without an account.
 *
 * Three rules hold it in place, and all three are here rather than in the routes:
 *
 * 1. **One project, always.** Every call resolves the project through `projectFromToken`, which
 *    checks the signature against that project's own `publicLinkVersion`, so a token reaches the
 *    single project it was signed for. Turning the link off, or replacing it, stops the writes at
 *    the same moment it stops the reads, because they come through the same door.
 * 2. **The item must be on that project.** The filter is the item's id with no account scope (the
 *    client has none) **and** the project id, so an id belonging to another project matches nothing
 *    even if someone has one.
 * 3. **It joins the owner's list.** An item written here is stored against the project's own
 *    `ownerId` and marked `addedBy: "client"`, so the owner sees it in their scoped reads straight
 *    away and both surfaces can say where it came from.
 *
 * What a client may do is deliberately the same as what the owner may do, including removing an
 * item (the owner asked for that): the link is sent to the client the work is for, and the owner
 * can stop all of it at any time from the project's own panel.
 */

/**
 * Why a write got nowhere: the link itself, or the item it named. They are told apart so a client
 * whose item the owner has just deleted is told that, rather than that their link is broken.
 *
 * It is the one place this module says more than "no": a refusal about the **link** always reads
 * the same, as everywhere else here, and `"item"` can only be reached by a caller who already holds
 * a working token, which is a 256-bit HMAC and cannot be arrived at by guessing.
 */
export type PublicWriteFailure = "link" | "item"
export type PublicWrite<T> = { ok: true; value: T } | { ok: false; reason: PublicWriteFailure }

const failed = (reason: PublicWriteFailure): PublicWrite<never> => ({ ok: false, reason })

/** Adds one item through a shared link. */
export async function addPublicProjectTask(token: string, input: ProjectTaskInput): Promise<PublicWrite<ProjectTask>> {
  const project = await projectFromToken(token)
  if (!project) return failed("link")
  const projectId = project._id.toString()
  const task = await createProjectTask(
    // The client's items are the project owner's records, counted against the same per-tab ceiling
    { project, projectId, ownerId: project.ownerId ?? null, addedBy: "client", scope: {} },
    input
  )
  return { ok: true, value: task }
}

/** Changes one item of that project through a shared link. Only the fields given are written. */
export async function updatePublicProjectTask(token: string, taskId: string, input: Partial<ProjectTaskInput>): Promise<PublicWrite<ProjectTask>> {
  const filter = taskById(taskId)
  if (!filter) return failed("item")
  const project = await projectFromToken(token)
  if (!project) return failed("link")
  const task = await changeProjectTask(filter, project._id.toString(), input)
  return task ? { ok: true, value: task } : failed("item")
}

/** Removes one item of that project through a shared link, with its images and its voice note. */
export async function deletePublicProjectTask(token: string, taskId: string): Promise<PublicWrite<true>> {
  const filter = taskById(taskId)
  if (!filter) return failed("item")
  const project = await projectFromToken(token)
  if (!project) return failed("link")
  return (await removeProjectTask(filter, project._id.toString())) ? { ok: true, value: true } : failed("item")
}

/** Whether a token still opens a project, for the upload routes to check before storing anything. */
export async function publicProjectExists(token: string): Promise<boolean> {
  return (await projectFromToken(token)) !== null
}
