"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { PromptEditorCard } from "@/components/admin/prompts/PromptEditorCard"
import { requestApi } from "@/lib/apiClient"
import { ADMIN_PROMPTS_ENDPOINT, ADMIN_PROMPT_MESSAGES, GLOBAL_SECTION_ID, promptLabel, promptPrefixesOf } from "@/constants/adminPrompts"
import type { PromptModuleEntry } from "@/lib/promptModules"
import type { AdminPrompt } from "@/types/adminPrompts"

/**
 * Every prompt of one module, each in its own editor: the **system instructions** first (the rules
 * and wording the module always sends the AI), then the **user instructions** (the tones, tunes and
 * styles its users choose between). Read fresh whenever a module is chosen, so the page always starts
 * from what is saved now; the parent keys this view by the module, so choosing another one starts
 * clean and sends any edit still waiting on the way out.
 */

const loadPrompts = (tool: string, signal: AbortSignal) =>
  requestApi<AdminPrompt[]>(`${ADMIN_PROMPTS_ENDPOINT}?tool=${encodeURIComponent(tool)}`, { signal }).then(({ data }) => data)

export const ModulePromptsView: React.FC<{ module: PromptModuleEntry }> = ({ module }) => {
  const [prompts, setPrompts] = useState<AdminPrompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tools = module.tools.join(",")

  useEffect(() => {
    const controller = new AbortController()
    Promise.all(tools.split(",").map((tool) => loadPrompts(tool, controller.signal)))
      .then((lists) => setPrompts(lists.flat()))
      .catch((problem: unknown) => {
        if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : ADMIN_PROMPT_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [tools])

  const Icon = module.icon
  const prefixes = module.tools.flatMap(promptPrefixesOf)
  const system = prompts?.filter((prompt) => !prompt.editable) ?? []
  const user = prompts?.filter((prompt) => prompt.editable) ?? []

  return (
    <section aria-labelledby="prompt-module-heading" className="flex min-w-0 flex-col gap-5">
      <header className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="prompt-module-heading" className="text-[17px] font-bold text-on-surface">
            {module.title}
          </h2>
          <p className="text-[13px] text-on-surface-variant">{module.description}</p>
          <p className="mt-1 text-[12px] text-outline">
            {ADMIN_PROMPT_MESSAGES.promptCount(module.total)} · {ADMIN_PROMPT_MESSAGES.autosaveNote}
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[13px] text-error">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : !prompts ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
          Loading the prompts...
        </p>
      ) : prompts.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.noneStored}</p>
      ) : (
        <>
          <PromptGroup heading={ADMIN_PROMPT_MESSAGES.systemHeading} hint={ADMIN_PROMPT_MESSAGES.systemHint} prompts={system} prefixes={prefixes} />
          <PromptGroup
            heading={ADMIN_PROMPT_MESSAGES.userHeading}
            hint={module.id === GLOBAL_SECTION_ID ? ADMIN_PROMPT_MESSAGES.globalUserHint : ADMIN_PROMPT_MESSAGES.userHint}
            prompts={user}
            prefixes={prefixes}
          />
        </>
      )}
    </section>
  )
}

const PromptGroup: React.FC<{ heading: string; hint: string; prompts: AdminPrompt[]; prefixes: string[] }> = ({ heading, hint, prompts, prefixes }) => {
  if (prompts.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-bold text-on-surface">
          {heading} <span className="font-semibold text-outline">({prompts.length})</span>
        </h3>
        <p className="text-[12px] text-on-surface-variant">{hint}</p>
      </div>
      {prompts.map((prompt) => (
        <PromptEditorCard key={prompt.key} prompt={prompt} label={promptLabel(prompt.key, prefixes)} />
      ))}
    </div>
  )
}
