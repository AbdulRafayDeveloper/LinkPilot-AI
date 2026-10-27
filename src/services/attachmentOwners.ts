import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { TaskImageOwner, type AttachmentKind } from "@/models/TaskImageOwner"

/**
 * Whose each stored attachment is (models/TaskImageOwner.ts), for every module whose records name an
 * object in storage by its id alone: Daily Tasks, an employee's plan, Client Projects and Post Image
 * Creator's brand photos.
 *
 * Three rules, the same everywhere:
 * - **every upload is recorded** as it is stored (`recordAttachmentOwner`);
 * - **a save accepts only ids the record's own owners uploaded** (`assertOwnAttachments`); an id the
 *   record already carried is always kept, since it was checked when it was first saved;
 * - **a delete removes only those owners' objects** (`ownedAttachmentIds`), so a record that names
 *   someone else's id anyway (saved before the check existed) never deletes it.
 *
 * "Owners" is a list because a client project's item may be written by the project's owner, by an
 * admin working on it, or through its shared link, which uploads for the project's owner.
 */

type Owners = string | null | readonly (string | null)[]

const ownerList = (owners: Owners): string[] => (Array.isArray(owners) ? owners : [owners]).filter((owner): owner is string => Boolean(owner))

// A row written before kinds existed has none and is a task image
const kindFilter = (kind: AttachmentKind) => (kind === "task-image" ? { kind: { $in: [kind, null] } } : { kind })

/**
 * Notes whose an object is, as it is stored. Safe to repeat (a finished upload asked again lands on
 * the same row), and it never moves an id already recorded to someone else.
 */
export async function recordAttachmentOwner(assetId: string, ownerId: string, kind: AttachmentKind, contentType: string): Promise<void> {
  await connectDatabase()
  await TaskImageOwner.updateOne({ assetId }, { $setOnInsert: { assetId, ownerId, kind, contentType } }, { upsert: true })
}

/**
 * Refuses a save naming an id of this kind that none of the owners uploaded. Ids in `alreadyOn` are
 * the record's own already and pass without a lookup.
 */
export async function assertOwnAttachments(
  owners: Owners,
  kind: AttachmentKind,
  assetIds: readonly string[],
  alreadyOn: readonly string[],
  message: string
): Promise<void> {
  const known = new Set(alreadyOn)
  const added = [...new Set(assetIds.filter((assetId) => assetId && !known.has(assetId)))]
  if (added.length === 0) return
  await connectDatabase()
  const owned = await TaskImageOwner.countDocuments({ assetId: { $in: added }, ownerId: { $in: ownerList(owners) }, ...kindFilter(kind) })
  if (owned !== added.length) throw new UserFacingError(message)
}

/**
 * Of these objects, the ids that are one of their own owners', so those alone may be removed from
 * storage; their rows are forgotten with them. Anything else is left for its real owner.
 */
export async function ownedAttachmentIds(kind: AttachmentKind, entries: readonly { assetId: string | null | undefined; owners: Owners }[]): Promise<Set<string>> {
  const named = entries.filter((entry): entry is { assetId: string; owners: Owners } => Boolean(entry.assetId))
  if (named.length === 0) return new Set()
  await connectDatabase()
  const rows = await TaskImageOwner.find({ assetId: { $in: named.map((entry) => entry.assetId) }, ...kindFilter(kind) }, { assetId: 1, ownerId: 1 }).lean()
  const ownerOf = new Map(rows.map((row) => [row.assetId, row.ownerId]))
  const theirs = new Set(named.filter((entry) => ownerList(entry.owners).includes(ownerOf.get(entry.assetId) ?? "")).map((entry) => entry.assetId))
  if (theirs.size > 0) await TaskImageOwner.deleteMany({ assetId: { $in: [...theirs] } })
  return theirs
}
