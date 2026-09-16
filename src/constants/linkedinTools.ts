import {
  Flame,
  Hand,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Repeat,
  Reply,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { CLIENT_MESSAGING_TOOL } from "./clientMessaging"
import { CLIENT_VOICES_TOOL } from "./clientVoices"
import { POST_IMAGES_TOOL } from "./postImages"
import { DAILY_TASKS_TOOL } from "./dailyTasks"
import { MESSAGE_REWRITER_TOOL } from "./messageRewriter"
import { PROMPT_CREATOR_TOOL } from "./promptCreator"
import { MEETING_PLANNER_TOOL } from "./meetingPlanner"
import { MEETINGS_TOOL } from "./meetings"
import { QUICK_NOTES_TOOL } from "./quickNotes"
import { IMPORTANT_FILES_TOOL } from "./importantFiles"
import { REFERENCE_CONTENT_TOOL } from "./referenceContent"

/**
 * The four areas of the app, in sidebar order. Each one is a heading in the sidebar, so keep
 * them few and meaningful: a tool that needs a heading of its own belongs in one of these.
 */
export const TOOL_GROUPS = [
  // Everything written for LinkedIn itself, from the post to the reply
  { id: "linkedin", label: "LinkedIn Tools" },
  // The people the work is for: what you send them, what they send back, and the meetings
  { id: "clients", label: "Client Work" },
  // Text for everything else: prompts for other AI tools, and messages in plain English
  { id: "writing", label: "Writing & Prompts" },
  // What the day and the work are kept in: tasks, notes, reusable text and files
  { id: "workspace", label: "Workspace" },
] as const

export type ToolGroupId = (typeof TOOL_GROUPS)[number]["id"]

export interface LinkedInTool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: ToolGroupId
}

/**
 * The 9 LinkedIn tools, in sidebar order: what to post about and the image for it, then
 * outreach, then engaging on posts, then conversations. The first one is where "/" lands.
 */
export const LINKEDIN_TOOLS: LinkedInTool[] = [
  { id: "trending-topics", title: "Trending Topics", description: "Web, AI & SaaS buzz", icon: Flame, href: "/trending-topics", group: "linkedin" },
  POST_IMAGES_TOOL,
  { id: "connection-note", title: "Connection Note", description: "Personalized connection requests", icon: UserPlus, href: "/connection-note", group: "linkedin" },
  { id: "first-message", title: "First Message", description: "Personalized first messages", icon: Hand, href: "/first-message", group: "linkedin" },
  { id: "inmail-composer", title: "InMail Message", description: "InMail with subject line", icon: Mail, href: "/inmail-message", group: "linkedin" },
  { id: "comment-writer", title: "Comment Writer", description: "Thoughtful LinkedIn comments", icon: MessageSquareText, href: "/comment-writer", group: "linkedin" },
  { id: "post-comment-replies", title: "Post Comment Replies", description: "Reply to post comments", icon: Reply, href: "/post-comment-replies", group: "linkedin" },
  { id: "follow-up-message", title: "Follow-Up Message", description: "Pitch & non-pitch follow-ups", icon: Repeat, href: "/follow-up-message", group: "linkedin" },
  { id: "conversation-reply", title: "Conversation Reply", description: "Next reply + deal signals", icon: MessagesSquare, href: "/conversation-reply", group: "linkedin" },
]

/**
 * Every tool the app has, in sidebar order: the 9 LinkedIn tools, then the other modules under
 * their own groups. This is the one list the sidebar, the switcher, the sitemap, the manifest
 * and the SEO pages all read, so a tool added here shows up everywhere at once.
 */
export const APP_TOOLS: LinkedInTool[] = [
  ...LINKEDIN_TOOLS,
  CLIENT_MESSAGING_TOOL,
  CLIENT_VOICES_TOOL,
  MEETING_PLANNER_TOOL,
  MEETINGS_TOOL,
  PROMPT_CREATOR_TOOL,
  MESSAGE_REWRITER_TOOL,
  DAILY_TASKS_TOOL,
  QUICK_NOTES_TOOL,
  REFERENCE_CONTENT_TOOL,
  IMPORTANT_FILES_TOOL,
]
