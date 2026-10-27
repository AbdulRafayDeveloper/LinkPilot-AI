import { Globe, Puzzle, type LucideIcon } from "lucide-react"
import { APP_TOOLS, TOOL_GROUPS } from "@/constants/linkedinTools"
import {
  GLOBAL_SECTION_DESCRIPTION,
  GLOBAL_SECTION_ID,
  GLOBAL_SECTION_LABEL,
  GLOBAL_SECTION_TOOLS,
  MODULE_PROMPT_TOOLS,
  OTHER_PROMPTS_LABEL,
} from "@/constants/adminPrompts"
import { matchesWords } from "@/lib/nameSearch"
import type { PromptModuleStats } from "@/types/adminPrompts"

/**
 * The list Administration → Global AI Prompts is read by, built from **what is stored**: the global
 * and shared prompts first, then every area of the sidebar in its own order with the modules that
 * have prompts, named and ordered as the sidebar names and orders them, then anything stored under a
 * `tool` no area knows. A prompt added to the database therefore appears here with no code change,
 * and a module with nothing stored is never listed.
 */

export interface PromptModuleEntry {
  // What the page selects by: a tool's id in APP_TOOLS, the global entry, or `tool:<tool>` for the rest
  id: string
  title: string
  description: string
  icon: LucideIcon
  // The `tool` values its prompts are stored under
  tools: string[]
  total: number
  system: number
}

export interface PromptModuleSection {
  id: string
  label: string
  modules: PromptModuleEntry[]
}

const OTHER_PREFIX = "tool:"

export function promptModuleSections(stats: readonly PromptModuleStats[]): PromptModuleSection[] {
  const byTool = new Map(stats.map((row) => [row.tool, row]))
  const countOf = (tools: readonly string[]) =>
    tools.reduce((sum, tool) => ({ total: sum.total + (byTool.get(tool)?.total ?? 0), system: sum.system + (byTool.get(tool)?.system ?? 0) }), {
      total: 0,
      system: 0,
    })
  const named = new Set<string>(GLOBAL_SECTION_TOOLS)

  const global = countOf(GLOBAL_SECTION_TOOLS)
  const sections: PromptModuleSection[] = []
  if (global.total > 0) {
    sections.push({
      id: GLOBAL_SECTION_ID,
      label: GLOBAL_SECTION_LABEL,
      modules: [{ id: GLOBAL_SECTION_ID, title: GLOBAL_SECTION_LABEL, description: GLOBAL_SECTION_DESCRIPTION, icon: Globe, tools: [...GLOBAL_SECTION_TOOLS], ...global }],
    })
  }

  for (const group of TOOL_GROUPS) {
    const modules = APP_TOOLS.filter((tool) => tool.group === group.id && tool.id in MODULE_PROMPT_TOOLS).flatMap((tool) => {
      const stored = MODULE_PROMPT_TOOLS[tool.id]
      named.add(stored)
      const counts = countOf([stored])
      return counts.total > 0 ? [{ id: tool.id, title: tool.title, description: tool.description, icon: tool.icon, tools: [stored], ...counts }] : []
    })
    if (modules.length > 0) sections.push({ id: group.id, label: group.label, modules })
  }

  const others = stats
    .filter((row) => !named.has(row.tool) && row.total > 0)
    .map((row) => ({ id: `${OTHER_PREFIX}${row.tool}`, title: row.tool, description: row.tool, icon: Puzzle, tools: [row.tool], total: row.total, system: row.system }))
  if (others.length > 0) sections.push({ id: "other", label: OTHER_PROMPTS_LABEL, modules: others })
  return sections
}

/** The sections with only the modules whose name has every word typed, any order and case. */
export function narrowSections(sections: readonly PromptModuleSection[], search: string): PromptModuleSection[] {
  if (!search.trim()) return [...sections]
  return sections
    .map((section) => ({ ...section, modules: section.modules.filter((module) => matchesWords(`${module.title} ${section.label}`, search)) }))
    .filter((section) => section.modules.length > 0)
}

/** The module an id names, or the first one listed when it names none (or nothing was chosen yet). */
export function chosenModule(sections: readonly PromptModuleSection[], id: string | null): PromptModuleEntry | null {
  const all = sections.flatMap((section) => section.modules)
  return all.find((module) => module.id === id) ?? all[0] ?? null
}
