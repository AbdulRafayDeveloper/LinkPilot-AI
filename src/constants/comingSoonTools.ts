import { FileSearch, MessageCircleMore, PenLine, Send, TrendingUp, Video, type LucideIcon } from "lucide-react"

/**
 * The tools that are on the sidebar but not built yet, under the areas the owner asked for: Finance,
 * Upwork, Fiverr and Hubstaff Talent. Each opens its own page, and most also have a "view all" page in a
 * dropdown, like a LinkedIn tool; every one of those pages says it is coming soon and under
 * development (`components/ui/ComingSoonPage`) until the tool is built (`comingSoon` on the tool).
 * When one is built it leaves this list and becomes an ordinary tool.
 */
export type ComingSoonGroup = "finance" | "upwork" | "fiverr" | "hubstaff-talent"

export interface ComingSoonTool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: ComingSoonGroup
  comingSoon: true
  // What the tool's own page is called in its dropdown
  createTitle: string
  // The "view all" page, for a tool that has one; a tool without it is a single page in the sidebar
  view?: { href: string; title: string; heading: string }
}

export const COMING_SOON_TOOLS: readonly ComingSoonTool[] = [
  // Finance
  {
    id: "finance-investment-plans",
    title: "Investment Plans",
    description: "Your plans for what to invest in",
    icon: TrendingUp,
    href: "/finance/investment-plans",
    group: "finance",
    comingSoon: true,
    createTitle: "Investment Plans",
  },
  // Upwork
  {
    id: "upwork-proposal-analyzer",
    title: "Proposal Analyzer",
    description: "How a proposal reads to the client",
    icon: FileSearch,
    href: "/upwork/proposal-analyzer",
    group: "upwork",
    comingSoon: true,
    createTitle: "Analyze a Proposal",
    view: { href: "/upwork/proposal-analyzer/history", title: "View All Analyses", heading: "Saved Proposal Analyses" },
  },
  {
    id: "upwork-proposal-writer",
    title: "Proposal Writer",
    description: "A proposal written for one job post",
    icon: PenLine,
    href: "/upwork/proposal-writer",
    group: "upwork",
    comingSoon: true,
    createTitle: "Write a Proposal",
    view: { href: "/upwork/proposal-writer/history", title: "View All Proposals", heading: "Saved Proposals" },
  },
  {
    id: "upwork-client-conversation",
    title: "Conversation with Client",
    description: "The next reply to an Upwork client",
    icon: MessageCircleMore,
    href: "/upwork/client-conversation",
    group: "upwork",
    comingSoon: true,
    createTitle: "Reply to a Client",
    view: { href: "/upwork/client-conversation/history", title: "View All Conversations", heading: "Saved Client Conversations" },
  },
  // Fiverr
  {
    id: "fiverr-client-conversation",
    title: "Conversation with Client",
    description: "The next reply to a Fiverr buyer",
    icon: MessageCircleMore,
    href: "/fiverr/client-conversation",
    group: "fiverr",
    comingSoon: true,
    createTitle: "Reply to a Client",
    view: { href: "/fiverr/client-conversation/history", title: "View All Conversations", heading: "Saved Fiverr Conversations" },
  },
  // Hubstaff Talent
  {
    id: "hubstaff-apply-on-job",
    title: "Apply on Job",
    description: "An application for one Hubstaff Talent job",
    icon: Send,
    href: "/hubstaff-talent/apply-on-job",
    group: "hubstaff-talent",
    comingSoon: true,
    createTitle: "Apply on a Job",
    view: { href: "/hubstaff-talent/apply-on-job/history", title: "View All Applications", heading: "Saved Job Applications" },
  },
  {
    id: "hubstaff-client-conversation",
    title: "Conversation with Client",
    description: "The next reply to a Hubstaff Talent client",
    icon: MessageCircleMore,
    href: "/hubstaff-talent/client-conversation",
    group: "hubstaff-talent",
    comingSoon: true,
    createTitle: "Reply to a Client",
    view: { href: "/hubstaff-talent/client-conversation/history", title: "View All Conversations", heading: "Saved Hubstaff Conversations" },
  },
  {
    id: "hubstaff-related-video",
    title: "Send the Related Video",
    description: "The video that fits what the client asked",
    icon: Video,
    href: "/hubstaff-talent/related-video",
    group: "hubstaff-talent",
    comingSoon: true,
    createTitle: "Send the Related Video",
  },
]

/** One of these tools by its id, for its pages; every id passed is one of `COMING_SOON_TOOLS`. */
export const comingSoonTool = (id: string): ComingSoonTool => {
  const tool = COMING_SOON_TOOLS.find((entry) => entry.id === id)
  if (!tool) throw new Error(`No coming-soon tool is called ${id}`)
  return tool
}
