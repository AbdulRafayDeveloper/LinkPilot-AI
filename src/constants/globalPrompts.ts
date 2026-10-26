import { Globe, type LucideIcon } from "lucide-react"

/**
 * Global AI Prompts registry: app-wide prompts that aren't tied to one LinkedIn tool.
 * Each owns an independent, separately stored prompt (prompt record:
 * global-<id> in the prompts collection). Every tool's output is rewritten with the Humanization
 * prompt (services/humanizer.ts); Post Comment Replies takes Abdul's facts from Rafay Profile Info.
 *
 * **`adminOnly` decides who may read and change a prompt**, at the owner's request: Rafay Profile
 * Info is on Global AI Prompts for every account, while Humanization lives under Administration
 * (`/admin/global-prompts`) and only an admin ever sees or saves it. Every tool still reads it the
 * same way, so who may edit it changes nothing about what it does.
 */
export const GLOBAL_PROMPTS = [
  {
    id: "rafay-profile",
    label: "Rafay Profile Info",
    description: "Abdul Rafay's background, experience, projects and skills, written as a reusable prompt.",
    usage: "Used by Post Comment Replies as the source of your experience, projects and numbers",
    adminOnly: false,
  },
  {
    id: "humanization",
    label: "Humanization Prompt",
    description: "Rewrites existing text so it reads naturally, like a person wrote it, without changing its meaning.",
    usage: "Used by all 8 LinkedIn tools: every result is rewritten with it before you see it",
    adminOnly: true,
  },
] as const

export type GlobalPromptId = (typeof GLOBAL_PROMPTS)[number]["id"]

export const GLOBAL_PROMPT_IDS = GLOBAL_PROMPTS.map((prompt) => prompt.id) as [GlobalPromptId, ...GlobalPromptId[]]

// The prompts every account may read and change (Global AI Prompts), and the ones only an admin may
export const SHARED_GLOBAL_PROMPTS = GLOBAL_PROMPTS.filter((prompt) => !prompt.adminOnly)
export const ADMIN_GLOBAL_PROMPTS = GLOBAL_PROMPTS.filter((prompt) => prompt.adminOnly)
export const SHARED_GLOBAL_PROMPT_IDS = SHARED_GLOBAL_PROMPTS.map((prompt) => prompt.id) as [GlobalPromptId, ...GlobalPromptId[]]
export const ADMIN_GLOBAL_PROMPT_IDS = ADMIN_GLOBAL_PROMPTS.map((prompt) => prompt.id) as [GlobalPromptId, ...GlobalPromptId[]]

export const GLOBAL_PROMPTS_ENDPOINT = "/api/global-prompts"
export const ADMIN_GLOBAL_PROMPTS_ENDPOINT = "/api/admin/global-prompts"
export const ADMIN_GLOBAL_PROMPTS_HREF = "/admin/global-prompts"

export function getGlobalPromptUsage(id: GlobalPromptId): string {
  return GLOBAL_PROMPTS.find((prompt) => prompt.id === id)?.usage ?? ""
}

export function getGlobalPromptLabel(id: GlobalPromptId): string {
  return GLOBAL_PROMPTS.find((prompt) => prompt.id === id)?.label ?? id
}

// The module's sidebar entry, shown below the LinkedIn tools
export const GLOBAL_PROMPTS_LINK: { id: string; title: string; description: string; icon: LucideIcon; href: string } = {
  id: "global-prompts",
  title: "Global AI Prompts",
  description: "Your profile information prompt",
  icon: Globe,
  href: "/global-prompts",
}
