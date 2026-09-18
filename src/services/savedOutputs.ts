import mongoose, { type Collection } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { allOf, createdBetween, searchCondition } from "@/lib/listQuery"
import {
  CommentRecord,
  ConnectionNoteRecord,
  ConversationReplyRecord,
  FirstMessageRecord,
  FollowUpMessageRecord,
  InMailMessageRecord,
  PostCommentReplyRecord,
  ClientMessageRecord,
  RewrittenMessageRecord,
} from "@/models/GenerationRecords"
import { CreatedPromptModel } from "@/models/CreatedPrompt"
import { IN_ANY_FOLDER, UNFILED_FOLDER } from "@/constants/promptFolders"
import { folderNames } from "@/services/promptCreator/folders"
import { blockingIds, dependenciesOf, forgetDeletedPrompts, namedDependencies } from "@/services/promptCreator/dependencies"
import type { PromptDependency } from "@/types/promptCreator"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import type { SavedOutputTool, SavedOutputToolId } from "@/constants/savedOutputs"
import type {
  SavedOutput,
  SavedOutputChoice,
  SavedOutputDetail,
  SavedOutputFilters,
  SavedOutputText,
  SavedOutputsPage,
} from "@/types/savedOutputs"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Reads back what the LinkedIn tools wrote. Every tool already keeps its outputs in its own
 * collection (services/generationRecords.ts); this lists them newest first, a page at a time,
 * with the search, the choice filters and the date range all applied in the database, and reads or
 * deletes one record. A user sees and deletes only what their account wrote; an admin sees
 * everyone's, each record named with its author. What a record was written from (a pasted profile,
 * a conversation) only leaves the database one record at a time.
 */

type Row = Record<string, unknown> & { _id: { toString: () => string }; createdAt: Date }

interface OutputReader {
  collection: () => Collection
  // The field naming the folder a record is filed in, for a tool whose records have folders
  folderField?: string
  // The field holding when the record was marked as used, for a tool whose records can be
  appliedField?: string
  // The field holding the records this one waits for, for a tool whose records have dependencies
  dependencyField?: string
  // The field holding the tone, tune, type or style, and for replies the field holding the context
  optionField: string
  contextField?: string
  // Where a search looks: who it was for and what was written, never the whole pasted profile
  searchFields: readonly string[]
  source: { field: string; label: string }
  texts: (row: Row) => SavedOutputText[]
  heading: (row: Row) => { title: string; subtitle: string | null; tags: string[] }
  // The options of a filter the records themselves define, such as the clients written to
  recordChoices?: (collection: Collection, scope: Record<string, unknown>) => Promise<SavedOutputChoice[]>
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const LEAD_SEARCH = ["lead.name", "lead.company", "lead.headline"] as const

// Who a record was written for, as the pasted profile or conversation showed it
function leadHeading(row: Row, fallback: string) {
  const lead = (row.lead ?? {}) as { name?: unknown; headline?: unknown; company?: unknown }
  const company = text(lead.company)
  return {
    title: text(lead.name) || fallback,
    subtitle: text(lead.headline) || null,
    tags: company ? [company] : [],
  }
}

// The start of a longer text on one line, as a title
function excerpt(value: unknown): string {
  const line = text(value).replace(/\s+/g, " ")
  return line.length > 90 ? `${line.slice(0, 90).trimEnd()}...` : line
}

// The start of a post, as the title of what was written about it
function postHeading(row: Row, fallback: string) {
  return { title: excerpt(row.postText) || fallback, subtitle: null, tags: [] }
}

const byLabel = (a: SavedOutputChoice, b: SavedOutputChoice) => a.label.localeCompare(b.label)

const written = (label: string, value: unknown): SavedOutputText[] => (text(value) ? [{ label, text: text(value) }] : [])

const READERS: Record<SavedOutputToolId, OutputReader> = {
  "connection-note": {
    collection: () => ConnectionNoteRecord.collection,
    optionField: "tone",
    searchFields: [...LEAD_SEARCH, "companyName", "note"],
    source: { field: "profileData", label: "Profile" },
    texts: (row) => written("Note", row.note),
    heading: (row) => leadHeading(row, "Unknown person"),
  },
  "first-message": {
    collection: () => FirstMessageRecord.collection,
    optionField: "tune",
    searchFields: [...LEAD_SEARCH, "message"],
    source: { field: "profileData", label: "Profile" },
    texts: (row) => written("Message", row.message),
    heading: (row) => leadHeading(row, "Unknown person"),
  },
  "inmail-message": {
    collection: () => InMailMessageRecord.collection,
    optionField: "tune",
    searchFields: [...LEAD_SEARCH, "subject", "message"],
    source: { field: "profileData", label: "Profile" },
    texts: (row) => [...written("Subject", row.subject), ...written("Message", row.message)],
    heading: (row) => leadHeading(row, "Unknown person"),
  },
  "comment-writer": {
    collection: () => CommentRecord.collection,
    optionField: "tune",
    searchFields: ["comment", "postText"],
    source: { field: "postText", label: "Post" },
    texts: (row) => written("Comment", row.comment),
    heading: (row) => postHeading(row, row.postSource === "image" ? "Comment on a post screenshot" : "Comment on a post"),
  },
  "post-comment-replies": {
    collection: () => PostCommentReplyRecord.collection,
    optionField: "style",
    contextField: "context",
    searchFields: ["replyingTo", "reply", "postText"],
    source: { field: "comments", label: "Comments" },
    texts: (row) => written("Reply", row.reply),
    heading: (row) => {
      const post = postHeading(row, "")
      return { title: text(row.replyingTo) ? `Reply to ${text(row.replyingTo)}` : "Reply to a comment", subtitle: post.title || null, tags: [] }
    },
  },
  "follow-up-message": {
    collection: () => FollowUpMessageRecord.collection,
    optionField: "followUpType",
    searchFields: [...LEAD_SEARCH, "message"],
    source: { field: "conversation", label: "Conversation" },
    texts: (row) => written("Message", row.message),
    heading: (row) => leadHeading(row, "Unknown person"),
  },
  "conversation-reply": {
    collection: () => ConversationReplyRecord.collection,
    optionField: "replyType",
    searchFields: [...LEAD_SEARCH, "reply", "strategyNote"],
    source: { field: "conversation", label: "Conversation" },
    texts: (row) => [...written("Reply", row.reply), ...written("Strategy note", row.strategyNote)],
    heading: (row) => leadHeading(row, "Unknown person"),
  },
  "client-messaging": {
    collection: () => ClientMessageRecord.collection,
    optionField: "channel",
    contextField: "client.id",
    searchFields: ["client.name", "subject", "message", "update"],
    source: { field: "update", label: "Update" },
    texts: (row) => [...written("Subject", row.subject), ...written("Message", row.message)],
    heading: (row) => {
      const client = (row.client ?? {}) as { name?: unknown; country?: unknown }
      return { title: text(client.name) || "Unknown client", subtitle: text(client.country) || null, tags: [] }
    },
    // Every client a message went to, named as they were when the latest message was written
    recordChoices: async (collection, scope) => {
      const clients = await collection
        .aggregate<{ _id: unknown; name: unknown }>([{ $match: scope }, { $sort: { createdAt: -1 } }, { $group: { _id: "$client.id", name: { $first: "$client.name" } } }])
        .toArray()
      return clients
        .filter((client) => text(client._id) && text(client.name))
        .map((client) => ({ id: text(client._id), label: text(client.name) }))
        .sort(byLabel)
    },
  },
  "prompt-creator": {
    collection: () => CreatedPromptModel.collection,
    optionField: "target",
    folderField: "folderId",
    appliedField: "appliedAt",
    dependencyField: "dependencyIds",
    contextField: "requestSource",
    searchFields: ["name", "prompt", "request"],
    source: { field: "request", label: "Description" },
    texts: (row) => written("Prompt", row.prompt),
    heading: (row) => ({ title: text(row.name) || "Untitled prompt", subtitle: null, tags: row.editedAt ? ["Edited by hand"] : [] }),
  },
  "message-rewriter": {
    collection: () => RewrittenMessageRecord.collection,
    optionField: "source",
    contextField: "sourceLanguage",
    searchFields: ["original", "message"],
    source: { field: "original", label: "Original" },
    texts: (row) => written("Rewritten message", row.message),
    heading: (row) => {
      const language = text(row.sourceLanguage)
      return { title: excerpt(row.message) || "Rewritten message", subtitle: null, tags: language ? [`From ${language}`] : [] }
    },
    // Every language a message was rewritten from
    recordChoices: async (collection, scope) => {
      const languages = (await collection.distinct("sourceLanguage", scope)).map(text).filter(Boolean)
      return languages.map((language) => ({ id: language, label: language })).sort(byLabel)
    },
  },
}

/**
 * The label a choice is shown with; an id no longer in the list still shows as itself. A choice the
 * records define (a client, a language) is already in the row's own heading, so it adds no label.
 */
function choiceLabel(tool: SavedOutputTool, key: "option" | "context", id: unknown): string | null {
  const value = text(id)
  const filter = tool.filters.find((entry) => entry.key === key)
  if (!value || filter?.fromServer) return null
  return filter?.options.find((option) => option.id === value)?.label ?? value
}

// A dotted field ("client.id") read from a record
const fieldValue = (row: Row, field: string): unknown =>
  field.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), row)

// The ids a record waits for, as they were saved; anything else reads as waiting for nothing
const waitingIds = (row: Row, field: string): string[] => {
  const value = row[field]
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
}

function toSavedOutput(
  tool: SavedOutputTool,
  reader: OutputReader,
  row: Row,
  folders?: Map<string, string>,
  dependencies?: Map<string, PromptDependency>
): SavedOutput {
  const heading = reader.heading(row)
  const choices = [
    choiceLabel(tool, "context", reader.contextField ? fieldValue(row, reader.contextField) : null),
    choiceLabel(tool, "option", fieldValue(row, reader.optionField)),
  ]
  return {
    id: row._id.toString(),
    createdAt: new Date(row.createdAt).toISOString(),
    title: heading.title,
    subtitle: heading.subtitle,
    choices: choices.filter((label): label is string => label !== null),
    details: heading.tags,
    texts: reader.texts(row),
    characterCount: typeof row.characterCount === "number" ? row.characterCount : null,
    sourceLabel: text(row[reader.source.field]) ? reader.source.label : null,
    provider: text(row.provider) || null,
    // A folder that was deleted while the page was open reads as no folder rather than as a gap
    ...(reader.folderField ? { folder: folderOf(row, reader.folderField, folders) } : {}),
    ...(reader.appliedField ? { appliedAt: appliedOf(row, reader.appliedField) } : {}),
    // A record it waited for that has since been deleted is left out: it can never run again, so
    // waiting for it would block this one for ever
    ...(reader.dependencyField
      ? { dependencies: dependenciesOf(waitingIds(row, reader.dependencyField), dependencies ?? new Map()) }
      : {}),
  }
}

// When a record was marked as used, as the page reads it
function appliedOf(row: Row, field: string): string | null {
  const value = row[field]
  return value ? new Date(value as string | number | Date).toISOString() : null
}

// Which folder a record is in, with the name to show for it
function folderOf(row: Row, field: string, folders?: Map<string, string>): { id: string; name: string } | null {
  const id = text(row[field])
  const name = id ? folders?.get(id) : undefined
  return id && name ? { id, name } : null
}

// One record the viewer may see, matched by its ObjectId in the tool's own collection
function recordFilter(viewer: Viewer, id: string): Record<string, unknown> | null {
  const filter = visibleById(viewer, id)
  return filter ? { ...filter, _id: new mongoose.Types.ObjectId(id) } : null
}

/**
 * One page of a tool's outputs, newest first: exactly HISTORY_PAGE_SIZE, and the total counts
 * everything the filters match. A page past the end comes back as the last page rather than as
 * nothing, so deleting the last record on the last page never leaves an empty screen.
 */
export async function listSavedOutputs(viewer: Viewer, tool: SavedOutputTool, filters: SavedOutputFilters): Promise<SavedOutputsPage> {
  const reader = READERS[tool.id as SavedOutputToolId]
  await connectDatabase()
  const collection = reader.collection()
  const pageSize = HISTORY_PAGE_SIZE

  const scope = visibleTo(viewer)
  // A tool with folders needs them anyway, to name each record's folder. They are read first because
  // the folder filters are decided against the folders the viewer really has, not against the field
  // alone, so a record the page cannot name a folder for is filtered exactly as it is shown
  const folders = reader.folderField ? await folderNames(viewer) : undefined
  // Which records block others is worked out once, from the ids that are really waited on, so the
  // filter runs in the database over the whole list rather than over the page on screen
  const blocking = reader.dependencyField && filters.dependencies ? await blockingIds(viewer) : undefined
  const matching = matchingFilter(viewer, reader, filters, folders, blocking)

  const serverFilter = tool.filters.find((filter) => filter.fromServer)
  const [total, recordChoices] = await Promise.all([
    collection.countDocuments(matching),
    serverFilter && reader.recordChoices ? reader.recordChoices(collection, scope) : Promise.resolve(null),
  ])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page), totalPages)
  const rows = (await collection
    .find(matching, { projection: { result: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray()) as unknown as Row[]

  // One query names everything this page waits for, however many records that is between them
  const waiting = reader.dependencyField
    ? await namedDependencies(viewer, rows.flatMap((row) => waitingIds(row, reader.dependencyField as string)))
    : undefined
  const items = rows.map((row) => toSavedOutput(tool, reader, row, folders, waiting))
  warnAboutLostFolders(tool, reader, rows, items)

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    choices: serverFilter && recordChoices ? { [serverFilter.key]: recordChoices } : {},
  }
}

/**
 * Exactly the records a set of filters covers, for the viewer. The list and the bulk delete both go
 * through here, so a delete can never reach a record the same filters would not have shown.
 */
function matchingFilter(
  viewer: Viewer,
  reader: OutputReader,
  filters: SavedOutputFilters,
  folders: Map<string, string> | undefined,
  blocking: string[] | undefined,
  // Reading shows an admin every account's records; deleting a whole filter only ever takes their own
  scope: Record<string, unknown> = visibleTo(viewer)
): Record<string, unknown> {
  return allOf([
    scope,
    searchCondition(filters.search, reader.searchFields),
    filters.option ? { [reader.optionField]: filters.option } : null,
    filters.context && reader.contextField ? { [reader.contextField]: filters.context } : null,
    folderCondition(reader, filters.folder, folders),
    dependencyCondition(reader, filters.dependencies, blocking),
    createdBetween(filters.from, filters.to),
  ])
}

/**
 * Which records one of the three states keeps. They are worked out from `blocking`, the records that
 * are really waited on and have not run, so the three never overlap and cover the whole list between
 * them: independent waits for nothing, blocked waits for at least one of those, and ready waits for
 * records that have all run. A record waiting only for records that no longer exist is ready, which
 * is what the list shows it as, because a deleted record can never run again.
 */
function dependencyCondition(reader: OutputReader, state: string, blocking: string[] | undefined): Record<string, unknown> | null {
  const field = reader.dependencyField
  if (!field || !state) return null
  if (state === "independent") return { $or: [{ [field]: { $exists: false } }, { [field]: { $size: 0 } }] }
  const pending = blocking ?? []
  if (state === "blocked") return { [field]: { $in: pending } }
  return allOf([{ [`${field}.0`]: { $exists: true } }, { [field]: { $nin: pending } }])
}

/**
 * Deletes records in one go: the ones named by `ids`, or every record the filters cover when
 * `ids` is left out. Both are held inside the viewer's own scope (`visibleTo`), so a user can only
 * ever delete their own and an admin only what they can see, and both use the same filter the list
 * uses, so what goes is what was on screen. Answers how many were really deleted.
 */
export async function deleteSavedOutputs(
  viewer: Viewer,
  tool: SavedOutputTool,
  filters: SavedOutputFilters,
  ids?: string[]
): Promise<{ deleted: number }> {
  const reader = READERS[tool.id as SavedOutputToolId]
  await connectDatabase()
  const folders = reader.folderField ? await folderNames(viewer) : undefined
  const blocking = reader.dependencyField && filters.dependencies ? await blockingIds(viewer) : undefined
  // Ticked rows follow the per-record delete (an admin may delete a record they can see); a whole
  // filter follows Clear All and the Daily Tasks cleanup, which never reach another account's records
  const matching = matchingFilter(viewer, reader, filters, folders, blocking, ids ? visibleTo(viewer) : ownedBy(viewer))
  const chosen = ids ? { ...matching, _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } : matching
  // Which records are going is read first, so what waited for them can be freed once they are gone
  const going = reader.dependencyField ? ((await reader.collection().find(chosen, { projection: { _id: 1 } }).toArray()) as unknown as Row[]) : []
  const { deletedCount } = await reader.collection().deleteMany(chosen)
  if (reader.dependencyField) await forgetDeletedPrompts(viewer, going.map((row) => row._id.toString()))
  return { deleted: deletedCount ?? 0 }
}

/**
 * A record that names a folder nothing can be found for is shown, counted and filtered as "No folder",
 * which is the only honest thing to do with it, but it is never silent: one line per page says how many
 * there were. The app cannot make this state (filing a record checks the folder, and deleting a folder
 * frees its records), so it means a write that went round the app: a `folderId` saved with the wrong
 * type, which reads as no folder at all, or a folder deleted without its records being freed.
 */
function warnAboutLostFolders(tool: SavedOutputTool, reader: OutputReader, rows: Row[], items: SavedOutput[]): void {
  const field = reader.folderField
  if (!field) return
  const lost = rows.filter((row, index) => row[field] !== null && row[field] !== undefined && !items[index].folder).length
  if (lost > 0) console.warn(`⚠️ ${lost} ${tool.id} record(s) name a folder that can't be found; they read as "No folder"`)
}

/**
 * Which records a folder filter keeps: one folder, the ones in any folder, the ones in none, or every
 * record. Filed means **a folder the viewer really has**, matched by its id rather than by the field
 * merely being set, so the filters say exactly what each row shows: a record the page can name a folder
 * for is filed, and anything else is not. The two choices are therefore always the whole list between
 * them, whatever odd value a record carries (see warnAboutLostFolders).
 */
function folderCondition(reader: OutputReader, folder: string, folders?: Map<string, string>): Record<string, unknown> | null {
  if (!reader.folderField || !folder) return null
  const filed = [...(folders?.keys() ?? [])]
  if (folder === UNFILED_FOLDER) return { [reader.folderField]: { $nin: filed } }
  if (folder === IN_ANY_FOLDER) return { [reader.folderField]: { $in: filed } }
  return { [reader.folderField]: folder }
}

/** One record with the whole text it was written from. Null when it's gone or belongs to another account. */
export async function getSavedOutput(viewer: Viewer, tool: SavedOutputTool, id: string): Promise<SavedOutputDetail | null> {
  const filter = recordFilter(viewer, id)
  if (!filter) return null
  const reader = READERS[tool.id as SavedOutputToolId]
  await connectDatabase()
  const row = (await reader.collection().findOne(filter, { projection: { result: 0 } })) as unknown as Row | null
  if (!row) return null
  const folders = reader.folderField ? await folderNames(viewer) : undefined
  const waiting = reader.dependencyField ? await namedDependencies(viewer, waitingIds(row, reader.dependencyField)) : undefined
  return { ...toSavedOutput(tool, reader, row, folders, waiting), source: text(row[reader.source.field]) }
}

/** Deletes one record. False when it's gone or belongs to another account. */
export async function deleteSavedOutput(viewer: Viewer, tool: SavedOutputTool, id: string): Promise<boolean> {
  const filter = recordFilter(viewer, id)
  if (!filter) return false
  const reader = READERS[tool.id as SavedOutputToolId]
  await connectDatabase()
  const { deletedCount } = await reader.collection().deleteOne(filter)
  // Nothing is left waiting for a record that has gone
  if (deletedCount > 0 && reader.dependencyField) await forgetDeletedPrompts(viewer, [id])
  return deletedCount > 0
}
