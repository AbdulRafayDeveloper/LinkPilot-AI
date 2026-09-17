import { CONNECTION_NOTE_TONES } from "./connectionNote"
import { FIRST_MESSAGE_TUNES } from "./firstMessage"
import { INMAIL_TUNES } from "./inmail"
import { COMMENT_TUNES } from "./commentWriter"
import { REPLY_CONTEXTS, REPLY_STYLES } from "./postCommentReplies"
import { FOLLOW_UP_TYPES } from "./followUp"
import { CONVERSATION_REPLY_TYPES } from "./conversationReply"
import { MESSAGE_CHANNELS } from "./clientMessaging"
import { PROMPT_TARGETS } from "./promptCreator"
import { PROMPT_CREATOR_RECORD_ENDPOINT, PROMPT_FOLDERS_ENDPOINT } from "./promptFolders"

/**
 * The "view all" page of every tool that writes text: the LinkedIn tools, Client Messaging, Prompt
 * Creator and Message Rewriter. Each one already saves what it writes to its own collection; this
 * is how those records are read back, filtered and shown. The sidebar dropdown, the page, its SEO entry and the API route all
 * read this one list, so adding a tool here is the whole change on the client side.
 */

export const SAVED_OUTPUTS_ENDPOINT = "/api/saved-outputs"
// A written text longer than this is cut to a few lines in the table, with Show all to open it
export const SAVED_OUTPUT_TEXT_PREVIEW_CHARS = 220

export interface SavedOutputFilter {
  // Which of the record's choices it filters: the tone, tune, type or style, or (for replies) the context
  key: "option" | "context"
  label: string
  allLabel: string
  options: readonly { id: string; label: string }[]
  // The options are what the records hold (the clients written to, the languages rewritten from),
  // so they arrive with the list rather than from a fixed list here
  fromServer?: boolean
}

// Whether what a module worked from was typed or spoken
const INPUT_SOURCES = [
  { id: "text", label: "Typed" },
  { id: "voice", label: "Spoken" },
] as const

export interface SavedOutputTool {
  // The tool's own route without the slash, which is also the API's [tool] segment
  id: string
  toolHref: string
  // The sidebar's two pages
  createTitle: string
  createDescription: string
  viewTitle: string
  viewDescription: string
  // The page itself
  heading: string
  intro: string
  noun: { one: string; many: string }
  // The heading of the table column that says who or what each record is
  titleHeading: string
  // Starts every written text hidden, with Show to open it (Connection Note)
  hideTexts?: boolean
  searchPlaceholder: string
  filters: readonly SavedOutputFilter[]
  /**
   * Set only for a tool whose records are filed in folders (today: Prompt Creator). The "view all"
   * page then offers a folder filter, a Move button on each record and a Folders manager, all
   * talking to this route; every other tool behaves exactly as it did before folders existed.
   */
  folders?: { endpoint: string; label: string; recordEndpoint: string }
}

export const SAVED_OUTPUT_TOOLS = [
  {
    id: "connection-note",
    toolHref: "/connection-note",
    createTitle: "Write New Note",
    createDescription: "Write a connection note",
    viewTitle: "View All Notes",
    viewDescription: "Every note written so far",
    heading: "All Connection Notes",
    intro: "Every connection note written so far, with who it was for and the LinkedIn profile behind it.",
    noun: { one: "note", many: "notes" },
    titleHeading: "Person",
    hideTexts: true,
    searchPlaceholder: "Name, company or note",
    filters: [{ key: "option", label: "Tone", allLabel: "All tones", options: CONNECTION_NOTE_TONES }],
  },
  {
    id: "first-message",
    toolHref: "/first-message",
    createTitle: "Write New Message",
    createDescription: "Write a first message",
    viewTitle: "View All Messages",
    viewDescription: "Every first message written so far",
    heading: "All First Messages",
    intro: "Every first message written so far, with who it was for.",
    noun: { one: "message", many: "messages" },
    titleHeading: "Person",
    searchPlaceholder: "Name, company or message",
    filters: [{ key: "option", label: "Tone", allLabel: "All tones", options: FIRST_MESSAGE_TUNES }],
  },
  {
    id: "inmail-message",
    toolHref: "/inmail-message",
    createTitle: "Write New InMail",
    createDescription: "Write an InMail",
    viewTitle: "View All InMails",
    viewDescription: "Every InMail written so far",
    heading: "All InMail Messages",
    intro: "Every InMail written so far, subject and message, with who it was for.",
    noun: { one: "InMail", many: "InMails" },
    titleHeading: "Person",
    searchPlaceholder: "Name, company, subject or message",
    filters: [{ key: "option", label: "Tone", allLabel: "All tones", options: INMAIL_TUNES }],
  },
  {
    id: "comment-writer",
    toolHref: "/comment-writer",
    createTitle: "Write New Comment",
    createDescription: "Comment on a post",
    viewTitle: "View All Comments",
    viewDescription: "Every comment written so far",
    heading: "All Comments",
    intro: "Every comment written so far, with the post it was for.",
    noun: { one: "comment", many: "comments" },
    titleHeading: "Post",
    searchPlaceholder: "Comment or post text",
    filters: [{ key: "option", label: "Tune", allLabel: "All tunes", options: COMMENT_TUNES }],
  },
  {
    id: "post-comment-replies",
    toolHref: "/post-comment-replies",
    createTitle: "Write New Reply",
    createDescription: "Reply to a comment",
    viewTitle: "View All Replies",
    viewDescription: "Every comment reply written so far",
    heading: "All Comment Replies",
    intro: "Every reply to a post comment written so far, with who it answered.",
    noun: { one: "reply", many: "replies" },
    titleHeading: "Reply to",
    searchPlaceholder: "Name, reply or post text",
    filters: [
      { key: "context", label: "Context", allLabel: "Any post", options: REPLY_CONTEXTS },
      { key: "option", label: "Style", allLabel: "All styles", options: REPLY_STYLES },
    ],
  },
  {
    id: "follow-up-message",
    toolHref: "/follow-up-message",
    createTitle: "Write New Follow-Up",
    createDescription: "Follow up on a conversation",
    viewTitle: "View All Follow-Ups",
    viewDescription: "Every follow-up written so far",
    heading: "All Follow-Up Messages",
    intro: "Every follow-up written so far, with who it was for.",
    noun: { one: "follow-up", many: "follow-ups" },
    titleHeading: "Person",
    searchPlaceholder: "Name, company or message",
    filters: [{ key: "option", label: "Type", allLabel: "All types", options: FOLLOW_UP_TYPES }],
  },
  {
    id: "conversation-reply",
    toolHref: "/conversation-reply",
    createTitle: "Write New Reply",
    createDescription: "Reply in a conversation",
    viewTitle: "View All Replies",
    viewDescription: "Every conversation reply written so far",
    heading: "All Conversation Replies",
    intro: "Every conversation reply written so far, with who it was for and the strategy behind it.",
    noun: { one: "reply", many: "replies" },
    titleHeading: "Person",
    searchPlaceholder: "Name, company or reply",
    filters: [{ key: "option", label: "Tone", allLabel: "All tones", options: CONVERSATION_REPLY_TYPES }],
  },
  {
    id: "client-messaging",
    toolHref: "/client-messaging",
    createTitle: "Write New Message",
    createDescription: "Write a client update",
    viewTitle: "View All Messages",
    viewDescription: "Every client message written so far",
    heading: "All Client Messages",
    intro: "Every message written to a client so far, with the client, the channel and the update it came from.",
    noun: { one: "message", many: "messages" },
    titleHeading: "Client",
    searchPlaceholder: "Client, subject, message or update",
    filters: [
      { key: "context", label: "Client", allLabel: "All clients", options: [], fromServer: true },
      { key: "option", label: "Channel", allLabel: "All channels", options: MESSAGE_CHANNELS },
    ],
  },
  {
    id: "prompt-creator",
    toolHref: "/prompt-creator",
    createTitle: "Create New Prompt",
    createDescription: "Turn a task into a prompt",
    viewTitle: "View All Prompts",
    viewDescription: "Every prompt created so far",
    heading: "All Created Prompts",
    intro: "Every prompt created so far, with your edits, the target it was written for and the description it came from.",
    noun: { one: "prompt", many: "prompts" },
    titleHeading: "Prompt",
    searchPlaceholder: "Name, prompt or description",
    filters: [
      { key: "option", label: "Target", allLabel: "All targets", options: PROMPT_TARGETS },
      { key: "context", label: "Described by", allLabel: "Typed or spoken", options: INPUT_SOURCES },
    ],
    folders: { endpoint: PROMPT_FOLDERS_ENDPOINT, label: "Folder", recordEndpoint: PROMPT_CREATOR_RECORD_ENDPOINT },
  },
  {
    id: "message-rewriter",
    toolHref: "/message-rewriter",
    createTitle: "Rewrite New Message",
    createDescription: "Rewrite a message",
    viewTitle: "View All Rewrites",
    viewDescription: "Every message rewritten so far",
    heading: "All Rewritten Messages",
    intro: "Every message rewritten so far, with the original it came from.",
    noun: { one: "rewrite", many: "rewrites" },
    titleHeading: "Message",
    searchPlaceholder: "Original or rewritten message",
    filters: [
      { key: "context", label: "Language", allLabel: "All languages", options: [], fromServer: true },
      { key: "option", label: "Written by", allLabel: "Typed or spoken", options: INPUT_SOURCES },
    ],
  },
] as const satisfies readonly SavedOutputTool[]

export type SavedOutputToolId = (typeof SAVED_OUTPUT_TOOLS)[number]["id"]

export const savedOutputsHref = (tool: Pick<SavedOutputTool, "toolHref">) => `${tool.toolHref}/history`

export function getSavedOutputTool(id: string): SavedOutputTool | null {
  return SAVED_OUTPUT_TOOLS.find((tool) => tool.id === id) ?? null
}

export const SAVED_OUTPUT_MESSAGES = {
  loadFailed: "Couldn't load what was written. Please try again.",
  unknownTool: "There is no saved history for that tool.",
  sourceFailed: "Couldn't load what it was written from. Please try again.",
  deleteFailed: "Couldn't delete that. It is back in the list.",
  notFound: "That record no longer exists.",
  deleted: "Deleted",
} as const
