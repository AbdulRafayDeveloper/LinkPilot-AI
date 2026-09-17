import type { Collection } from "mongoose"
import { AssetFile } from "@/models/AssetFile"
import { Client } from "@/models/Client"
import { CreatedPromptModel } from "@/models/CreatedPrompt"
import { DailyTask } from "@/models/DailyTask"
import { EmployeeModel, EmployeePlanModel } from "@/models/Employee"
import {
  ClientMessageRecord,
  CommentRecord,
  ConnectionNoteRecord,
  ConversationReplyRecord,
  FirstMessageRecord,
  FollowUpMessageRecord,
  InMailMessageRecord,
  PostCommentReplyRecord,
  RewrittenMessageRecord,
} from "@/models/GenerationRecords"
import { Meeting } from "@/models/Meeting"
import { MeetingPlan } from "@/models/MeetingPlan"
import { PostImageModel } from "@/models/PostImage"
import { QuickNote } from "@/models/QuickNote"
import { ReferenceItem } from "@/models/ReferenceItem"
import { ImportantContentModel } from "@/models/ImportantContent"
import { TrendingSearch } from "@/models/TrendingSearch"
import { APP_TOOLS } from "@/constants/linkedinTools"
import type { ToolUsage } from "@/types/admin"

/**
 * What each account has made, tool by tool, read from the records the tools already keep (every
 * one carries its `ownerId`). Nothing extra is written while someone works, so this can't drift
 * from what is really stored.
 */

export interface ActivitySource {
  href: string
  // When a tool keeps more than one kind of record, which kind this is
  label?: string
  collection: () => Collection
  // Only records that really exist (an interrupted upload is not a file)
  match?: Record<string, unknown>
}

/**
 * Every kind of record an account owns, one entry per collection. Activity counts from this list,
 * and deleting an account (services/admin/deleteAccount.ts) deletes from it, so a new tool added
 * here is both counted and removed with the account.
 */
export const SOURCES: ActivitySource[] = [
  { href: "/trending-topics", label: "searches", collection: () => TrendingSearch.collection },
  { href: "/post-image-creator", label: "images", collection: () => PostImageModel.collection },
  { href: "/connection-note", collection: () => ConnectionNoteRecord.collection },
  { href: "/first-message", collection: () => FirstMessageRecord.collection },
  { href: "/inmail-message", collection: () => InMailMessageRecord.collection },
  { href: "/comment-writer", collection: () => CommentRecord.collection },
  { href: "/post-comment-replies", collection: () => PostCommentReplyRecord.collection },
  { href: "/follow-up-message", collection: () => FollowUpMessageRecord.collection },
  { href: "/conversation-reply", collection: () => ConversationReplyRecord.collection },
  { href: "/client-messaging", label: "messages", collection: () => ClientMessageRecord.collection },
  { href: "/client-messaging", label: "clients", collection: () => Client.collection },
  { href: "/meeting-planner", collection: () => MeetingPlan.collection },
  { href: "/meetings", collection: () => Meeting.collection },
  { href: "/prompt-creator", collection: () => CreatedPromptModel.collection },
  { href: "/message-rewriter", collection: () => RewrittenMessageRecord.collection },
  { href: "/daily-tasks", collection: () => DailyTask.collection },
  { href: "/quick-notes", collection: () => QuickNote.collection },
  { href: "/reference-content", collection: () => ReferenceItem.collection },
  { href: "/important-files", collection: () => AssetFile.collection, match: { status: "ready" } },
  { href: "/important-content", collection: () => ImportantContentModel.collection },
  { href: "/employees", label: "employees", collection: () => EmployeeModel.collection },
  { href: "/employees", label: "plans", collection: () => EmployeePlanModel.collection },
]

// The tool's own name from the navigation list, so the breakdown and the sidebar never disagree
export const titleOf = (source: ActivitySource) => {
  const tool = APP_TOOLS.find((entry) => entry.href === source.href)?.title ?? source.href
  return source.label ? `${tool} (${source.label})` : tool
}

type Usage = { count: number; last: Date | null }

/**
 * For each account id, what it made in each tool: one grouped query per kind of record, covering
 * every id at once, never one query per account.
 */
export async function usageByAccount(ids: string[]): Promise<Map<string, ToolUsage[]>> {
  const perSource = await Promise.all(
    SOURCES.map(async (source) => {
      const rows = await source
        .collection()
        .aggregate<{ _id: string; count: number; last: Date | null }>([
          { $match: { ownerId: { $in: ids }, ...(source.match ?? {}) } },
          { $group: { _id: "$ownerId", count: { $sum: 1 }, last: { $max: "$createdAt" } } },
        ])
        .toArray()
      return new Map<string, Usage>(rows.map((row) => [row._id, { count: row.count, last: row.last }]))
    })
  )

  return new Map(
    ids.map((id) => [
      id,
      SOURCES.map((source, index) => {
        const usage = perSource[index].get(id)
        return { title: titleOf(source), href: source.href, count: usage?.count ?? 0, lastUsedAt: usage?.last ? new Date(usage.last).toISOString() : null }
      }),
    ])
  )
}
