"use client"

import { useCallback, useEffect, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { PROMPT_PROJECTS_ENDPOINT, PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import type { PromptProject } from "@/types/promptProjects"

/**
 * The projects the Prompt Creator writes prompts for, loaded once per page and kept in step as they
 * are made, changed and deleted, so the picker and the manager show the same list without asking
 * again. Mirrors `usePromptFolders`, since both keep one list a page reads in several places.
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

  const byName = (list: PromptProject[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))

  const create = useCallback(async (input: { name: string; instructions: string }): Promise<PromptProject> => {
    const { data } = await requestApi<PromptProject>(
      PROMPT_PROJECTS_ENDPOINT,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
      { idempotent: true }
    )
    setProjects((current) => byName([...(current ?? []), data]))
    return data
  }, [])

  const save = useCallback(async (id: string, changes: { name?: string; instructions?: string }): Promise<PromptProject> => {
    const { data } = await requestApi<PromptProject>(`${PROMPT_PROJECTS_ENDPOINT}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    })
    setProjects((current) => byName((current ?? []).map((project) => (project.id === id ? data : project))))
    return data
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    await requestApi<{ freed: number }>(`${PROMPT_PROJECTS_ENDPOINT}/${id}`, { method: "DELETE" })
    setProjects((current) => (current ?? []).filter((project) => project.id !== id))
  }, [])

  /** One more prompt written in a project, so its count follows without loading the list again. */
  const countCreated = useCallback((id: string | null) => {
    if (!id) return
    setProjects((current) => (current ?? []).map((project) => (project.id === id ? { ...project, promptCount: project.promptCount + 1 } : project)))
  }, [])

  return { projects, error, create, save, remove, countCreated, reload: () => setAttempt((count) => count + 1) }
}
