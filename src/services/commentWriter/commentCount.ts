import { connectDatabase } from "@/lib/db"
import { CommentRecord } from "@/models/GenerationRecords"
import { ownedBy } from "@/services/auth/viewer"
import type { Viewer } from "@/types/auth"
import type { CommentCount } from "@/types/commentWriter"

/**
 * How many comments this account has written, read from the comments Comment Writer already saves
 * (comment_writer_comments), so nothing extra is written to keep a count.
 *
 * Scoped with ownedBy, not visibleTo: the number is the user's own reminder of how much commenting
 * they have done, so an admin counts their own comments rather than everybody's.
 */
export async function countComments(viewer: Viewer, since: Date): Promise<CommentCount> {
  await connectDatabase()
  const mine = ownedBy(viewer)
  const [today, total] = await Promise.all([
    CommentRecord.countDocuments({ ...mine, createdAt: { $gte: since } }),
    CommentRecord.countDocuments(mine),
  ])
  return { today, total }
}
