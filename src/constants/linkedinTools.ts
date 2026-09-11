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

export interface LinkedInTool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  // Set once the tool has a page; tools without one render as inert buttons
  href?: string
}

export const LINKEDIN_TOOLS: LinkedInTool[] = [
  { id: "trending-topics", title: "Trending Topics", description: "Latest IT & AI buzz", icon: Flame, href: "/trending-topics" },
  { id: "connection-note", title: "Connection Note", description: "Personalized connection requests", icon: UserPlus, href: "/connection-note" },
  { id: "comment-writer", title: "Comment Writer", description: "Thoughtful LinkedIn comments", icon: MessageSquareText, href: "/comment-writer" },
  { id: "post-comment-replies", title: "Post Comment Replies", description: "Reply to post comments", icon: Reply, href: "/post-comment-replies" },
  { id: "follow-up-message", title: "Follow-Up Message", description: "Pitch & non-pitch follow-ups", icon: Repeat, href: "/follow-up-message" },
  { id: "first-message", title: "First Message", description: "Personalized first messages", icon: Hand, href: "/first-message" },
  { id: "inmail-composer", title: "InMail Message", description: "InMail with subject line", icon: Mail, href: "/inmail-message" },
  { id: "conversation-reply", title: "Conversation Reply", description: "Next reply + deal signals", icon: MessagesSquare, href: "/conversation-reply" },
]
