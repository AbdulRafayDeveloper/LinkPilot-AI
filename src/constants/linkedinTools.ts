import {
  Flame,
  Hand,
  History,
  SquarePlus,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Repeat,
  Reply,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { CLIENTS_TOOL } from "./clients"
import { CLIENT_MESSAGING_TOOL } from "./clientMessaging"
import { CLIENT_VOICES_TOOL } from "./clientVoices"
import { POST_IMAGES_HISTORY_HREF, POST_IMAGES_TOOL } from "./postImages"
import { DAILY_TASKS_TOOL } from "./dailyTasks"
import { MESSAGE_REWRITER_TOOL } from "./messageRewriter"
import { PROMPT_CREATOR_TOOL } from "./promptCreator"
import { MEETING_PLANNER_TOOL } from "./meetingPlanner"
import { MEETINGS_TOOL } from "./meetings"
import { QUICK_NOTES_TOOL } from "./quickNotes"
import { IMPORTANT_FILES_TOOL } from "./importantFiles"
import { IMPORTANT_CONTENT_TOOL } from "./importantContent"
import { REFERENCE_CONTENT_TOOL } from "./referenceContent"
import { EMPLOYEES_TOOL } from "./employees"
import { ADMIN_TOOL } from "./admin"
import { TRENDING_HISTORY_HREF } from "./trending"
import { SAVED_OUTPUT_TOOLS, savedOutputsHref, type SavedOutputToolId } from "./savedOutputs"

/**
 * The four areas of the app, in sidebar order. Each one is a heading in the sidebar, so keep
 * them few and meaningful: a tool that needs a heading of its own belongs in one of these.
 */
export const TOOL_GROUPS = [
  // Everything written for LinkedIn itself, from the post to the reply
  { id: "linkedin", label: "LinkedIn Tools" },
  // The people the work is for: what you send them, what they send back, the text you reuse with
  // them, and the meetings
  { id: "clients", label: "Client Work" },
  // Prompts written for other AI tools
  { id: "prompts", label: "Prompts" },
  // What the day and the work are kept in: tasks, notes and files
  { id: "workspace", label: "Workspace" },
] as const

export type ToolGroupId = (typeof TOOL_GROUPS)[number]["id"]

/** One page inside a tool, shown under it in the sidebar's dropdown. */
export interface ToolLink {
  title: string
  description: string
  icon: LucideIcon
  href: string
  // The heading of a page other than the tool's own, which its SEO entry and social card also use
  pageTitle?: string
}

export interface LinkedInTool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  // The page the tool opens on: where "/" lands, and what the sitemap and manifest link to
  href: string
  group: ToolGroupId
  // A tool with more than one page is a dropdown in the sidebar, listing these instead of linking
  links?: ToolLink[]
  // Shown only to admins (the sidebar, the switcher) and left out of the sitemap and manifest; its routes check the role
  adminOnly?: boolean
}

/** A tool's two pages: where something new is made, and where everything made so far is listed. */
const toolPages = (
  toolHref: string,
  create: { title: string; description: string },
  view: { title: string; description: string; href: string; pageTitle: string }
): ToolLink[] => [
  { ...create, icon: SquarePlus, href: toolHref },
  { ...view, icon: History },
]

// The pages of a tool whose "view all" list is registered in constants/savedOutputs.ts
function savedOutputPages(id: SavedOutputToolId): ToolLink[] {
  const tool = SAVED_OUTPUT_TOOLS.find((entry) => entry.id === id)
  if (!tool) throw new Error(`No saved outputs page is registered for ${id}`)
  return toolPages(
    tool.toolHref,
    { title: tool.createTitle, description: tool.createDescription },
    { title: tool.viewTitle, description: tool.viewDescription, href: savedOutputsHref(tool), pageTitle: tool.heading }
  )
}

/**
 * The 9 LinkedIn tools, in sidebar order: what to post about and the image for it, then
 * outreach, then engaging on posts, then conversations. The first one is where "/" lands.
 */
export const LINKEDIN_TOOLS: LinkedInTool[] = [
  {
    id: "trending-topics",
    title: "Trending Topics",
    description: "Web, AI & SaaS buzz",
    icon: Flame,
    href: "/trending-topics",
    group: "linkedin",
    links: toolPages(
      "/trending-topics",
      { title: "Create New Topics", description: "Run a new live search" },
      { title: "View Existing Topics", description: "Every topic found so far", href: TRENDING_HISTORY_HREF, pageTitle: "Existing Trending Topics" }
    ),
  },
  {
    ...POST_IMAGES_TOOL,
    links: toolPages(
      POST_IMAGES_TOOL.href,
      { title: "Create New Image", description: "Draw an image for a post" },
      { title: "View All Images", description: "Every post image made so far", href: POST_IMAGES_HISTORY_HREF, pageTitle: "Generated Post Images" }
    ),
  },
  { id: "connection-note", title: "Connection Note", description: "Personalized connection requests", icon: UserPlus, href: "/connection-note", group: "linkedin", links: savedOutputPages("connection-note") },
  { id: "first-message", title: "First Message", description: "Personalized first messages", icon: Hand, href: "/first-message", group: "linkedin", links: savedOutputPages("first-message") },
  { id: "inmail-composer", title: "InMail Message", description: "InMail with subject line", icon: Mail, href: "/inmail-message", group: "linkedin", links: savedOutputPages("inmail-message") },
  { id: "comment-writer", title: "Comment Writer", description: "Thoughtful LinkedIn comments", icon: MessageSquareText, href: "/comment-writer", group: "linkedin", links: savedOutputPages("comment-writer") },
  { id: "post-comment-replies", title: "Post Comment Replies", description: "Reply to post comments", icon: Reply, href: "/post-comment-replies", group: "linkedin", links: savedOutputPages("post-comment-replies") },
  { id: "follow-up-message", title: "Follow-Up Message", description: "Pitch & non-pitch follow-ups", icon: Repeat, href: "/follow-up-message", group: "linkedin", links: savedOutputPages("follow-up-message") },
  { id: "conversation-reply", title: "Conversation Reply", description: "Next reply + deal signals", icon: MessagesSquare, href: "/conversation-reply", group: "linkedin", links: savedOutputPages("conversation-reply") },
]

/**
 * Every tool the app has, in sidebar order: the 9 LinkedIn tools, then the other modules under
 * their own groups. This is the one list the sidebar, the switcher, the sitemap, the manifest
 * and the SEO pages all read, so a tool added here shows up everywhere at once.
 */
export const APP_TOOLS: LinkedInTool[] = [
  ...LINKEDIN_TOOLS,
  // The people the work is for come before what is written to them
  CLIENTS_TOOL,
  { ...CLIENT_MESSAGING_TOOL, links: savedOutputPages("client-messaging") },
  { ...MESSAGE_REWRITER_TOOL, links: savedOutputPages("message-rewriter") },
  CLIENT_VOICES_TOOL,
  REFERENCE_CONTENT_TOOL,
  MEETING_PLANNER_TOOL,
  MEETINGS_TOOL,
  { ...PROMPT_CREATOR_TOOL, links: savedOutputPages("prompt-creator") },
  DAILY_TASKS_TOOL,
  QUICK_NOTES_TOOL,
  IMPORTANT_FILES_TOOL,
  IMPORTANT_CONTENT_TOOL,
  EMPLOYEES_TOOL,
  ADMIN_TOOL,
]

/**
 * The tools a signed-in account may see: everything for an admin, everything but the admin area
 * for a user, less any tool an admin has turned off for that account. Hiding a tool is only the
 * courtesy; its pages and its API refuse the account as well.
 */
export const toolsFor = (isAdmin: boolean, disabledTools: readonly string[] = []) =>
  APP_TOOLS.filter((tool) => (isAdmin || !tool.adminOnly) && !(!isAdmin && disabledTools.includes(tool.id)))

/** The tools the public surfaces (sitemap, manifest shortcuts) list, which never include the admin area. */
export const PUBLIC_TOOLS = APP_TOOLS.filter((tool) => !tool.adminOnly)
