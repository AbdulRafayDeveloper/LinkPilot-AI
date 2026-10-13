"use client"

import { useCallback, useEffect, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { PROMPT_PROJECTS_ENDPOINT, PROMPT_PROJECT_MESSAGES } from "@/constants/promptCreator"
import type { PromptProject } from "@/types/clients"

/**
 * The projects a prompt can be written for, loaded once per page. **They are the clients' own
 * projects** (Clients Management): this hook only reads them, because a project is made, renamed and
 * deleted under its client, so the picker can never offer a project that page does not show. It used
 * to create and delete them too, when Prompt Creator had a Projects module of its own.
 */
export function usePromptProjects({ enabled = true }: { enabled?: boolean } = {}) {
  const [projects, setProjects] = useState<PromptProject[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Not asked for at all while it can't be used, rather than asked for and refused
    if (!enabled) return
    const controller = new AbortController()
    requestApi<{ projects: PromptProject[] }>(PROMPT_PROJECTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setProjects(data.projects)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PROMPT_PROJECT_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt, enabled])

  /** One more prompt written for a project, so its count follows without loading the list again. */
  const countCreated = useCallback((id: string | null) => {
    if (!id) return
    setProjects((current) =>
      (current ?? []).map((project) => (project.id === id ? { ...project, promptCount: project.promptCount + 1 } : project))
    )
  }, [])

  return { projects, error, countCreated, reload: () => setAttempt((count) => count + 1) }
}
