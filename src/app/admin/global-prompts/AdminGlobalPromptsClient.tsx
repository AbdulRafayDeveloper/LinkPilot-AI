"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Globe, Loader2 } from "lucide-react"
import { GlobalPromptsPage } from "@/components/global-prompts/GlobalPromptsPage"
import { PromptModuleNav } from "@/components/admin/prompts/PromptModuleNav"
import { ModulePromptsView } from "@/components/admin/prompts/ModulePromptsView"
import { requestApi } from "@/lib/apiClient"
import { chosenModule, promptModuleSections } from "@/lib/promptModules"
import { ADMIN_PROMPTS_ENDPOINT, ADMIN_PROMPT_MESSAGES } from "@/constants/adminPrompts"
import type { PromptModuleStats } from "@/types/adminPrompts"

/**
 * Administration → Global AI Prompts: every prompt the system sends the AI, edited in one place and
 * by an admin alone. The modules that have prompts are listed down the left (the global and shared
 * prompts, then the sidebar's areas in its own order), and the module chosen shows every one of its
 * prompts on the right, system instructions first, each in an editor that saves itself. The list is
 * read from the database, so a prompt added later appears here by itself. The module open is in the
 * address (`?module=`), so a reload or a link opens the same one.
 */
export default function AdminGlobalPromptsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stats, setStats] = useState<PromptModuleStats[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<PromptModuleStats[]>(ADMIN_PROMPTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => setStats(data))
      .catch((problem: unknown) => {
        if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : ADMIN_PROMPT_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [])

  const sections = stats ? promptModuleSections(stats) : []
  const chosen = chosenModule(sections, searchParams.get("module"))
  const choose = (id: string) => router.replace(`?module=${encodeURIComponent(id)}`, { scroll: false })

  return (
    <GlobalPromptsPage
      heading="Global AI Prompts"
      intro="Every prompt the tools send the AI, module by module. Only admins may change them, and a change applies to every account and device."
      icon={Globe}
    >
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[13px] text-error">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : !stats ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
          Loading the modules...
        </p>
      ) : !chosen ? (
        <p className="text-[13px] text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.noneStored}</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <PromptModuleNav sections={sections} chosen={chosen} onChoose={choose} />
          <ModulePromptsView key={chosen.id} module={chosen} />
        </div>
      )}
    </GlobalPromptsPage>
  )
}
