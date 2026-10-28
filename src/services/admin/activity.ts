import type { Collection } from "mongoose"
import { AssetFile } from "@/models/AssetFile"
import { AssetFolder } from "@/models/AssetFolder"
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
import { FinanceChatMessageModel } from "@/models/FinanceChatMessage"
import { BudgetMonthModel, BudgetSettingsModel } from "@/models/Budget"
import { BUDGET_HREF } from "@/constants/budget"
import { MeetingPlan } from "@/models/MeetingPlan"
import { PostImageModel } from "@/models/PostImage"
import { QuickNote } from "@/models/QuickNote"
import { ReferenceItem } from "@/models/ReferenceItem"
import { ImportantContentModel } from "@/models/ImportantContent"
import { ContentFolderModel } from "@/models/ContentFolder"
import { PromptFolderModel } from "@/models/PromptFolder"
import { ClientProjectTaskModel } from "@/models/ClientProjectTask"
import { ClientVoiceModel } from "@/models/ClientVoice"
import { ClientVoiceTasksModel } from "@/models/ClientVoiceTasks"
import { ProfileScheduleModel } from "@/models/ProfileSchedule"
import { TrendingSearch } from "@/models/TrendingSearch"
import { ProfileEntryModel } from "@/models/ProfileEntry"
import { ProfileVectorModel } from "@/models/ProfileVector"
import { GLOBAL_PROMPTS_LINK } from "@/constants/globalPrompts"
import { APP_TOOLS } from "@/constants/linkedinTools"
import { PERSONAL_DRIVE_HREF } from "@/constants/importantFiles"
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
  { href: "/comment-writer", label: "comments", collection: () => CommentRecord.collection },
  { href: "/comment-writer", label: "profiles", collection: () => ProfileScheduleModel.collection },
  { href: "/post-comment-replies", collection: () => PostCommentReplyRecord.collection },
  { href: "/follow-up-message", collection: () => FollowUpMessageRecord.collection },
  { href: "/conversation-reply", collection: () => ConversationReplyRecord.collection },
  { href: "/client-messaging", label: "messages", collection: () => ClientMessageRecord.collection },
  { href: "/client-messaging", label: "clients", collection: () => Client.collection },
  { href: "/client-projects", label: "tasks", collection: () => ClientProjectTaskModel.collection },
  // Client Voices keeps every batch and every voice in it, so both are counted and both go with
  // the account; without this an account's recordings would outlive it in the bucket
  { href: "/client-voices", label: "batches", collection: () => ClientVoiceTasksModel.collection },
  { href: "/client-voices", label: "voices", collection: () => ClientVoiceModel.collection },
  { href: "/meeting-planner", collection: () => MeetingPlan.collection },
  { href: "/meetings", collection: () => Meeting.collection },
  { href: "/prompt-creator", collection: () => CreatedPromptModel.collection },
  { href: "/message-rewriter", collection: () => RewrittenMessageRecord.collection },
  { href: "/daily-tasks", collection: () => DailyTask.collection },
  { href: "/quick-notes", collection: () => QuickNote.collection },
  { href: "/reference-content", collection: () => ReferenceItem.collection },
  { href: PERSONAL_DRIVE_HREF, label: "files", collection: () => AssetFile.collection, match: { status: "ready" } },
  // The drive's own folders, counted and deleted with the account the way every other module's are
  { href: PERSONAL_DRIVE_HREF, label: "folders", collection: () => AssetFolder.collection },
  { href: "/important-content", collection: () => ImportantContentModel.collection },
  { href: "/important-content", label: "folders", collection: () => ContentFolderModel.collection },
  // Prompt Creator's folders, which a client project also makes one of; counted and deleted with
  // the account, the way Important Content's are. Without this an account's folders outlived it
  { href: "/prompt-creator", label: "folders", collection: () => PromptFolderModel.collection },
  { href: "/employees", label: "employees", collection: () => EmployeeModel.collection },
  { href: "/employees", label: "plans", collection: () => EmployeePlanModel.collection },
  // The person's own Finance Bot chat, counted and deleted with the account
  { href: "/finance/finance-bot", label: "messages", collection: () => FinanceChatMessageModel.collection },
  // The person's own budget: its months and its settings, counted and deleted with the account
  { href: BUDGET_HREF, label: "budget months", collection: () => BudgetMonthModel.collection },
  { href: BUDGET_HREF, label: "budget settings", collection: () => BudgetSettingsModel.collection },
  // My AI Profile: the person's own entries and the vectors Gemini wrote for them and their Profile Info
  { href: GLOBAL_PROMPTS_LINK.href, label: "entries", collection: () => ProfileEntryModel.collection },
  { href: GLOBAL_PROMPTS_LINK.href, label: "search vectors", collection: () => ProfileVectorModel.collection },
]

// The tool's own name from the navigation list, so the breakdown and the sidebar never disagree
export const titleOf = (source: ActivitySource) => {
  const tool = APP_TOOLS.find((entry) => entry.href === source.href)?.title ?? (source.href === GLOBAL_PROMPTS_LINK.href ? GLOBAL_PROMPTS_LINK.title : source.href)
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
