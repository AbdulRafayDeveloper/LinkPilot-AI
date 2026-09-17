"use client"

import { useCallback, useEffect, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { PROMPT_FOLDER_MESSAGES } from "@/constants/promptFolders"
import type { PromptFolder } from "@/types/promptFolders"

/**
 * The folders a tool files its records in, loaded once per page and kept in step as they are made,
 * renamed and deleted, so every picker on the page shows the same list without asking again.
 * `endpoint` is the tool's own folders route; with none, nothing is loaded and the page behaves as
 * it did before folders existed.
 */
export function usePromptFolders(endpoint: string | undefined) {
  const [folders, setFolders] = useState<PromptFolder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!endpoint) return
    const controller = new AbortController()
    requestApi<{ folders: PromptFolder[] }>(endpoint, { signal: controller.signal })
      .then(({ data }) => {
        setFolders(data.folders)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PROMPT_FOLDER_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [endpoint, attempt])

  const byName = (list: PromptFolder[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))

  const create = useCallback(
    async (name: string): Promise<PromptFolder> => {
      const { data } = await requestApi<PromptFolder>(endpoint ?? "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      setFolders((current) => byName([...(current ?? []), data]))
      return data
    },
    [endpoint]
  )

  const rename = useCallback(
    async (id: string, name: string): Promise<void> => {
      const { data } = await requestApi<PromptFolder>(`${endpoint}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      setFolders((current) => byName((current ?? []).map((folder) => (folder.id === id ? data : folder))))
    },
    [endpoint]
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await requestApi<{ freed: number }>(`${endpoint}/${id}`, { method: "DELETE" })
      setFolders((current) => (current ?? []).filter((folder) => folder.id !== id))
    },
    [endpoint]
  )

  // A record moved in or out of a folder changes what the counts say
  const countMoved = useCallback((from: string | null, to: string | null) => {
    setFolders((current) =>
      (current ?? []).map((folder) => {
        if (folder.id === from) return { ...folder, promptCount: Math.max(0, folder.promptCount - 1) }
        if (folder.id === to) return { ...folder, promptCount: folder.promptCount + 1 }
        return folder
      })
    )
  }, [])

  return { folders, error, create, rename, remove, countMoved, reload: () => setAttempt((count) => count + 1) }
}
