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
import { PROMPT_CREATOR_TOOL } from "./promptCreator"

// What a tool helps with; the sidebar shows the tools under these headings, in this order
export const TOOL_GROUPS = [
  { id: "discover", label: "Discover" },
  { id: "outreach", label: "Outreach" },
  { id: "engage", label: "Engage on posts" },
  { id: "conversations", label: "Conversations" },
  // The Prompt Creator module, which writes prompts for other AI tools
  { id: "build", label: "Build prompts" },
  // Client Messaging, which writes updates to the people the work is for
  { id: "clients", label: "Client work" },
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
 * The app's entire navigation: exactly these 8 LinkedIn tools, in sidebar order (grouped as
 * TOOL_GROUPS). The first one is where "/" lands.
 */
export const LINKEDIN_TOOLS: LinkedInTool[] = [
  { id: "trending-topics", title: "Trending Topics", description: "Web, AI & SaaS buzz", icon: Flame, href: "/trending-topics", group: "discover" },
  { id: "connection-note", title: "Connection Note", description: "Personalized connection requests", icon: UserPlus, href: "/connection-note", group: "outreach" },
  { id: "first-message", title: "First Message", description: "Personalized first messages", icon: Hand, href: "/first-message", group: "outreach" },
  { id: "inmail-composer", title: "InMail Message", description: "InMail with subject line", icon: Mail, href: "/inmail-message", group: "outreach" },
  { id: "comment-writer", title: "Comment Writer", description: "Thoughtful LinkedIn comments", icon: MessageSquareText, href: "/comment-writer", group: "engage" },
  { id: "post-comment-replies", title: "Post Comment Replies", description: "Reply to post comments", icon: Reply, href: "/post-comment-replies", group: "engage" },
  { id: "follow-up-message", title: "Follow-Up Message", description: "Pitch & non-pitch follow-ups", icon: Repeat, href: "/follow-up-message", group: "conversations" },
  { id: "conversation-reply", title: "Conversation Reply", description: "Next reply + deal signals", icon: MessagesSquare, href: "/conversation-reply", group: "conversations" },
]

/**
 * Everything the sidebar, the switcher and the sitemap list: the 8 LinkedIn tools plus the
 * other modules, in that order.
 */
export const APP_TOOLS: LinkedInTool[] = [...LINKEDIN_TOOLS, PROMPT_CREATOR_TOOL, CLIENT_MESSAGING_TOOL]
