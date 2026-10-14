"use client"

import { useCallback, useEffect, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { DRIVE_FOLDERS_ENDPOINT, IMPORTANT_FILES_MESSAGES } from "@/constants/importantFiles"
import type { DriveFolder } from "@/types/importantFiles"

/**
 * The folders of Personal Drive, loaded once per page and kept in step as they are made, renamed,
 * moved and deleted, so the tree, the tiles, the breadcrumb and the Move picker all show the same
 * list without asking the server again.
 *
 * **A write answers with the folder, and the counts are read again** (`reload`), because what is
 * inside a folder is counted over the whole branch: moving one file changes the number on every
 * folder above it, which is arithmetic the page would get wrong on its own.
 */
export function useDriveFolders() {
  const [folders, setFolders] = useState<DriveFolder[] | null>(null)
  // How many files sit at the top of the drive, which only the server can count
  const [rootCount, setRootCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<{ folders: DriveFolder[]; rootCount: number }>(DRIVE_FOLDERS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setFolders(data.folders)
        setRootCount(data.rootCount)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : IMPORTANT_FILES_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  const create = useCallback(
    async (name: string, parentId: string | null): Promise<DriveFolder> => {
      const { data } = await requestApi<DriveFolder>(DRIVE_FOLDERS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      }, { idempotent: true })
      // The new folder shows at once; the counts above it are unchanged by an empty folder
      setFolders((current) => [...(current ?? []), data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    },
    []
  )

  const change = useCallback(async (id: string, changes: { name?: string; parentId?: string | null }): Promise<void> => {
    await requestApi<DriveFolder>(`${DRIVE_FOLDERS_ENDPOINT}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    })
    // A move changes the depth and the counts of two branches, so the tree is read again
    reload()
  }, [reload])

  const remove = useCallback(async (id: string): Promise<void> => {
    await requestApi<{ folders: number; files: number }>(`${DRIVE_FOLDERS_ENDPOINT}/${id}`, { method: "DELETE" })
    reload()
  }, [reload])

  return { folders, rootCount, error, create, change, remove, reload }
}
