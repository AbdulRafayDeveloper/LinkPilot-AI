"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { BookMarked, Plus, Search, X } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ReferenceList } from "@/components/reference-content/ReferenceList"
import { ReferenceItemDialog } from "@/components/reference-content/ReferenceItemDialog"
import { DeleteReferenceDialog } from "@/components/reference-content/DeleteReferenceDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import {
  REFERENCE_CONTENT_ENDPOINT,
  REFERENCE_CONTENT_MESSAGES,
  REFERENCE_SEARCH_MAX_LENGTH,
  SEARCH_DEBOUNCE_MS,
} from "@/constants/referenceContent"
import type { ReferenceItem, ReferenceItemInput, ReferenceItemsPage } from "@/types/referenceContent"

// The dialog is open for a new item, or for the item being edited
type Editing = { mode: "new" } | { mode: "edit"; item: ReferenceItem } | null

export default function ReferenceContentClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [typedSearch, setTypedSearch] = useState("")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Editing>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ReferenceItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const isFetchingRef = useRef(false)

  // Typing settles before the search runs, so a search is one request, not one per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typedSearch.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typedSearch])

  // The first batch: on arrival, whenever the search changes, and after saving or deleting
  useEffect(() => {
    const controller = new AbortController()
    const query = search ? `?search=${encodeURIComponent(search)}` : ""
    requestApi<ReferenceItemsPage>(`${REFERENCE_CONTENT_ENDPOINT}${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setItems(data.items)
        setNextCursor(data.nextCursor)
        setTotal(data.total)
        setListError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : REFERENCE_CONTENT_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [search, reloadAttempt])

  // Starts the list again from the newest item, keeping the current search
  const reload = useCallback(() => {
    setIsLoading(true)
    setListError(null)
    setReloadAttempt((attempt) => attempt + 1)
  }, [])

  const changeSearch = (value: string) => {
    setTypedSearch(value)
    // A new search starts from the first batch again
    setIsLoading(true)
  }

  // The batch after the last one, appended to what is already on screen
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursor) return
    isFetchingRef.current = true
    setIsLoadingMore(true)
    setListError(null)
    try {
      const query = `?cursor=${encodeURIComponent(nextCursor)}${search ? `&search=${encodeURIComponent(search)}` : ""}`
      const { data } = await requestApi<ReferenceItemsPage>(`${REFERENCE_CONTENT_ENDPOINT}${query}`)
      setItems((current) => {
        // An item already on screen is never added twice, whatever changed meanwhile
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...data.items.filter((item) => !seen.has(item.id))]
      })
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : REFERENCE_CONTENT_MESSAGES.moreFailed)
    } finally {
      isFetchingRef.current = false
      setIsLoadingMore(false)
    }
  }, [nextCursor, search])

  // Adding and editing both go through the one dialog, so the same form does both
  const saveItem = async (input: ReferenceItemInput) => {
    if (isSaving || !editing) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const isEdit = editing.mode === "edit"
      const { data, message } = await requestApi<ReferenceItem>(
        isEdit ? `${REFERENCE_CONTENT_ENDPOINT}/${editing.item.id}` : REFERENCE_CONTENT_ENDPOINT,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      )
      setEditing(null)
      setNotice(message || (isEdit ? REFERENCE_CONTENT_MESSAGES.updated : REFERENCE_CONTENT_MESSAGES.created))
      if (isEdit) {
        // The edited card updates in place, so the list does not jump while reading it
        setItems((current) => current.map((item) => (item.id === data.id ? data : item)))
      } else {
        reload()
      }
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : REFERENCE_CONTENT_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  // Deleting always asks first, and only the confirmed item goes
  const confirmDelete = async () => {
    if (!pendingDelete || deletingId) return
    setDeletingId(pendingDelete.id)
    setDeleteError(null)
    try {
      await requestApi<{ deleted: number }>(`${REFERENCE_CONTENT_ENDPOINT}/${pendingDelete.id}`, { method: "DELETE" })
      setItems((current) => current.filter((item) => item.id !== pendingDelete.id))
      setTotal((current) => Math.max(0, current - 1))
      setPendingDelete(null)
      setNotice(REFERENCE_CONTENT_MESSAGES.deleted)
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : REFERENCE_CONTENT_MESSAGES.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  const isSearching = search !== ""

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <BookMarked size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Clients Reference Content
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  The steps, procedures and explanations you send clients again and again, ready to copy.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null)
                    setEditing({ mode: "new" })
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                >
                  <Plus size={16} aria-hidden="true" />
                  Add Content
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 sm:max-w-md">
                <Search size={16} className="shrink-0 text-outline" aria-hidden="true" />
                <input
                  type="search"
                  value={typedSearch}
                  onChange={(event) => changeSearch(event.target.value)}
                  maxLength={REFERENCE_SEARCH_MAX_LENGTH}
                  aria-label="Search saved content by name or text"
                  placeholder="Search by name or by what is inside..."
                  className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                />
                {typedSearch !== "" && (
                  <button
                    type="button"
                    onClick={() => changeSearch("")}
                    aria-label="Clear the search"
                    className="rounded-md p-1 text-outline transition-colors hover:bg-surface-container hover:text-primary"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-outline" aria-live="polite">
                {notice ?? (total > 0 ? `${total.toLocaleString()} ${isSearching ? "match this search" : "saved"}` : "")}
              </p>
            </div>

            <ReferenceList
              items={items}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasMore={nextCursor !== null}
              error={listError}
              isSearching={isSearching}
              deletingId={deletingId}
              onRetry={reload}
              onLoadMore={loadMore}
              onEdit={(item) => {
                setSaveError(null)
                setEditing({ mode: "edit", item })
              }}
              onDelete={(item) => {
                setDeleteError(null)
                setPendingDelete(item)
              }}
            />
          </div>
        </main>
      </div>

      {editing && (
        <ReferenceItemDialog
          item={editing.mode === "edit" ? editing.item : null}
          isSaving={isSaving}
          error={saveError}
          onSave={saveItem}
          onClose={() => {
            if (isSaving) return
            setEditing(null)
            setSaveError(null)
          }}
        />
      )}

      {pendingDelete && (
        <DeleteReferenceDialog
          item={pendingDelete}
          isDeleting={deletingId !== null}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => {
            if (deletingId) return
            setPendingDelete(null)
            setDeleteError(null)
          }}
        />
      )}
    </div>
  )
}
