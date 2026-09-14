import { SITE_DESCRIPTION, SITE_PURPOSE } from "@/config/site"
import { LINKEDIN_TOOLS } from "./linkedinTools"

/**
 * Every page's search and sharing text in one place: the page metadata (lib/metadata.ts) and
 * its social preview image (app/og/[slug]) both read from here, so they never disagree.
 */
export interface SeoPage {
  slug: string
  path: string
  // The <title> part before " | LinkPilot AI"; leads with the search term ("LinkedIn …")
  title: string
  // The meta description, also the og:description and twitter:description
  description: string
  // The page's own search phrases
  keywords: string[]
  // The big line and the line under it on the social preview image (the tool's plain name)
  heading: string
  subheading: string
  // Private pages stay out of search results and the sitemap
  indexable: boolean
}

// Search text per tool: a title with the phrase people search for, what you paste, choose and get
const TOOL_SEO: Record<string, { title: string; description: string; keywords: string[] }> = {
  "trending-topics": {
    title: "LinkedIn Trending Topics & Post Ideas",
    description:
      "Discover fresh, source-backed web, AI and SaaS developments founders are discussing on LinkedIn, with ready-to-use searches and complete posts.",
    keywords: ["LinkedIn trending topics", "LinkedIn post ideas", "AI and SaaS news for LinkedIn", "LinkedIn content ideas"],
  },
  "connection-note": {
    title: "LinkedIn Connection Note Generator",
    description: "Paste a LinkedIn profile, pick a tone and generate a personalized connection request note in seconds.",
    keywords: ["LinkedIn connection note", "LinkedIn connection request message", "personalized connection request"],
  },
  "first-message": {
    title: "LinkedIn First Message Generator",
    description: "Paste a LinkedIn profile, pick an outreach tune and generate a personalized first message in seconds.",
    keywords: ["LinkedIn first message", "LinkedIn outreach message", "LinkedIn cold message"],
  },
  "inmail-composer": {
    title: "LinkedIn InMail Generator",
    description: "Paste a LinkedIn profile, pick an outreach tune and generate a personalized InMail subject and message.",
    keywords: ["LinkedIn InMail generator", "InMail subject line", "LinkedIn InMail message"],
  },
  "comment-writer": {
    title: "LinkedIn Comment Generator",
    description: "Write thoughtful, relevant LinkedIn comments from a pasted post or a screenshot, in six editable comment styles.",
    keywords: ["LinkedIn comment generator", "LinkedIn comments", "AI LinkedIn comment writer"],
  },
  "post-comment-replies": {
    title: "LinkedIn Comment Reply Generator",
    description:
      "Paste a LinkedIn post and its comments, choose your context and reply style, and generate a natural reply to the right comment.",
    keywords: ["LinkedIn comment reply", "reply to LinkedIn comments", "LinkedIn post engagement"],
  },
  "follow-up-message": {
    title: "LinkedIn Follow-Up Message Generator",
    description:
      "Paste your previous LinkedIn conversation, choose a pitch or non-pitch follow-up and generate a natural next message.",
    keywords: ["LinkedIn follow-up message", "LinkedIn follow up after no response", "LinkedIn sales follow-up"],
  },
  "conversation-reply": {
    title: "LinkedIn Conversation Reply Analyzer",
    description:
      "Paste a LinkedIn conversation to get the next reply plus evidence-based client, relationship, buying-intent and risk signals.",
    keywords: ["LinkedIn message reply", "LinkedIn conversation analysis", "LinkedIn buying signals"],
  },
}

export const HOME_SEO: SeoPage = {
  slug: "home",
  path: "/",
  title: SITE_PURPOSE,
  description: SITE_DESCRIPTION,
  keywords: ["LinkedIn writing assistant", "AI LinkedIn tools", "LinkedIn outreach tools"],
  heading: SITE_PURPOSE,
  subheading: "8 AI tools for notes, comments, replies and follow-ups",
  indexable: true,
}

export const SEO_PAGES: SeoPage[] = [
  HOME_SEO,
  ...LINKEDIN_TOOLS.map((tool) => ({
    slug: tool.href.slice(1),
    path: tool.href,
    title: TOOL_SEO[tool.id]?.title ?? tool.title,
    description: TOOL_SEO[tool.id]?.description ?? tool.description,
    keywords: TOOL_SEO[tool.id]?.keywords ?? [],
    heading: tool.title,
    subheading: tool.description,
    indexable: true,
  })),
  {
    slug: "global-prompts",
    path: "/global-prompts",
    title: "Global AI Prompts",
    description: "Password-protected prompts shared across LinkPilot AI: profile information and text humanization.",
    keywords: [],
    heading: "Global AI Prompts",
    subheading: "Profile and humanization prompts for every tool",
    indexable: false,
  },
]

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((page) => page.slug === slug)
}
