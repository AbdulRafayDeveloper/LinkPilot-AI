import { Globe, type LucideIcon } from "lucide-react"

/**
 * Global AI Prompts registry: app-wide prompts that aren't tied to one LinkedIn tool.
 * Each owns an independent, separately stored prompt (default template:
 * src/prompts/global-<id>.md). Every tool's output is rewritten with the Humanization
 * prompt (services/humanizer.ts); Post Comment Replies takes Abdul's facts from Rafay Profile Info.
 */
export const GLOBAL_PROMPTS = [
  {
    id: "rafay-profile",
    label: "Rafay Profile Info",
    description: "Abdul Rafay's background, experience, projects and skills, written as a reusable prompt.",
    usage: "Used by Post Comment Replies as the source of your experience, projects and numbers",
  },
  {
    id: "humanization",
    label: "Humanization Prompt",
    description: "Rewrites existing text so it reads naturally, like a person wrote it, without changing its meaning.",
    usage: "Used by all 8 LinkedIn tools: every result is rewritten with it before you see it",
  },
] as const

export type GlobalPromptId = (typeof GLOBAL_PROMPTS)[number]["id"]

export const GLOBAL_PROMPT_IDS = GLOBAL_PROMPTS.map((prompt) => prompt.id) as [GlobalPromptId, ...GlobalPromptId[]]

export function getGlobalPromptUsage(id: GlobalPromptId): string {
  return GLOBAL_PROMPTS.find((prompt) => prompt.id === id)?.usage ?? ""
}

export function getGlobalPromptLabel(id: GlobalPromptId): string {
  return GLOBAL_PROMPTS.find((prompt) => prompt.id === id)?.label ?? id
}

export function globalPromptKey(id: GlobalPromptId): string {
  return `global_prompt:${id}`
}

// The module's sidebar entry, shown below the LinkedIn tools
export const GLOBAL_PROMPTS_LINK: { id: string; title: string; description: string; icon: LucideIcon; href: string } = {
  id: "global-prompts",
  title: "Global AI Prompts",
  description: "Profile & humanization prompts",
  icon: Globe,
  href: "/global-prompts",
}
