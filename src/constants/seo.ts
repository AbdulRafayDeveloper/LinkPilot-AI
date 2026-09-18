import { SITE_DESCRIPTION, SITE_PURPOSE } from "@/config/site"
import { APP_TOOLS } from "./linkedinTools"

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
  "client-messaging": {
    title: "Client Update Message Writer",
    description:
      "Keep every client's own message format, then write formal updates for LinkedIn, Upwork, Fiverr, Slack, Discord, WhatsApp or email in seconds.",
    keywords: ["client update message", "client communication template", "freelance client messages"],
  },
  meetings: {
    title: "Meeting Notes to Tasks, Minutes & Action Items",
    description:
      "Paste a whole meeting, however long, and get the participants, the decisions, your own tasks and a short summary to send the client.",
    keywords: ["meeting minutes generator", "meeting transcript analysis", "action items from meeting"],
  },
  "quick-notes": {
    title: "Temporary Quick Notes, Save Text to Reuse",
    description: "Paste or write anything worth keeping, save it in one click, and copy it back whenever you need it.",
    keywords: ["save text notes", "copy paste notes", "reusable snippets"],
  },
  "important-content": {
    title: "Important Content, Saved Logins, Links and Text",
    description: "Keep the logins, links and text you need again under a name and a type of your own, then search by name and filter by type.",
    keywords: ["save important text", "store credentials and links", "snippet manager"],
  },
  employees: {
    title: "Employees Management and Team Plans",
    description: "Keep your team in one place, with each employee's role, city, joining date and status, a daily plan for each of them with the time every task was finished, and a link each employee can tick their tasks off from.",
    keywords: ["employee management", "team planning", "daily weekly monthly plans", "employee list"],
  },
  administration: {
    title: "Audit Management",
    description: "Every sign-in, sign-up and refused attempt, newest first, with the device and browser it came from.",
    keywords: [],
  },
  "daily-tasks": {
    title: "Daily Tasks, a Simple Day Checklist",
    description:
      "Write the day's tasks in one go, tick them off as you finish, and see at a glance what is still open from the last seven days.",
    keywords: ["daily task list", "daily checklist", "to-do list for work", "track daily tasks"],
  },
  "meeting-planner": {
    title: "Meeting Scheduler & Planner with Client Meeting Preparation",
    description:
      "Put a client meeting in the calendar, then have the profile and your conversation so far turned into a read of the person and a plan for the call.",
    keywords: ["meeting preparation", "client meeting planner", "sales call preparation", "discovery call plan"],
  },
  "prompt-creator": {
    title: "AI Prompt Generator for Coding Agents & Search",
    description:
      "Describe a task by voice or text and get a clear, detailed English prompt, shaped for a coding agent such as Cursor or Claude, or for ChatGPT and Gemini web search.",
    keywords: ["AI prompt generator", "prompt for Cursor", "Claude prompt generator", "ChatGPT search prompt"],
  },
  "message-rewriter": {
    title: "Message Rewriter and Shortener, Any Language to English",
    description:
      "Say or paste a message in any language and get it back as a short, clear English message that keeps what you meant, ready to edit and send.",
    keywords: ["message rewriter", "message shortener", "translate message to English", "make my message clearer"],
  },
  "important-files": {
    title: "Important Files and Assets Manager",
    description:
      "Keep the images, PDFs, Word files, text files, videos and audio you reuse, under names you choose, with search, type filters, preview and download.",
    keywords: ["file manager", "asset library", "store important files", "upload large video"],
  },
  "client-voices": {
    title: "Client Voice Messages to Transcript and Task List",
    description:
      "Paste or drop up to 15 client voice messages, read each one back as English text, and get one clear list of the work the client asked for.",
    keywords: ["voice message to text", "client voice notes", "transcribe WhatsApp voice", "voice to task list"],
  },
  "post-image-creator": {
    title: "On-Brand Post Image Creator",
    description:
      "Make a clean post image in your own brand colours, with your own photo in it, from whatever the post is about.",
    keywords: ["post image generator", "LinkedIn post image", "brand image creator", "AI post graphic"],
  },
  projects: {
    title: "Projects for Your Prompts",
    description:
      "Keep the projects your prompts are written for, each with standing instructions added to the end of every prompt created in it.",
    keywords: ["prompt projects", "project instructions", "manage projects", "prompt organizer"],
  },
  clients: {
    title: "Clients and Projects Manager",
    description:
      "Keep every client with the message format they expect and their sample messages, and the projects you are doing for each of them.",
    keywords: ["client manager", "client projects", "manage clients", "client work tracker"],
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
  keywords: ["LinkedIn writing assistant", "AI LinkedIn tools", "LinkedIn outreach tools", "client work assistant"],
  heading: SITE_PURPOSE,
  subheading: "9 LinkedIn tools, plus client work, meetings and your workspace",
  indexable: true,
}

export const SEO_PAGES: SeoPage[] = [
  HOME_SEO,
  ...APP_TOOLS.map((tool) => ({
    slug: tool.href.slice(1),
    path: tool.href,
    title: TOOL_SEO[tool.id]?.title ?? tool.title,
    description: TOOL_SEO[tool.id]?.description ?? tool.description,
    keywords: TOOL_SEO[tool.id]?.keywords ?? [],
    heading: tool.title,
    subheading: tool.description,
    indexable: !tool.adminOnly,
  })),
  // A tool's other pages (its "view all" list), read from the same dropdown links the sidebar shows
  ...APP_TOOLS.flatMap((tool) =>
    (tool.links ?? [])
      .filter((link) => link.href !== tool.href)
      .map((link) => ({
        slug: link.href.slice(1),
        path: link.href,
        title: link.pageTitle ?? link.title,
        description: `${link.description}, with search and filters. ${tool.title}, LinkPilot AI.`,
        keywords: [],
        heading: link.pageTitle ?? link.title,
        subheading: link.description,
        indexable: false,
      }))
  ),
  {
    slug: "login",
    path: "/login",
    title: "Sign In",
    description: "Sign in to LinkPilot AI, the workspace for LinkedIn posts, outreach and client updates.",
    keywords: [],
    heading: "Sign in to LinkPilot",
    subheading: "Your outreach and client workspace",
    indexable: false,
  },
  {
    slug: "signup",
    path: "/signup",
    title: "Create an Account",
    description: "Create a LinkPilot AI account to keep your posts, messages and prompts in one place.",
    keywords: [],
    heading: "Create your LinkPilot account",
    subheading: "Your outreach and client workspace",
    indexable: false,
  },
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
