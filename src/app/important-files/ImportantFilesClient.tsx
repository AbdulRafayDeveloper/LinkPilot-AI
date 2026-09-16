"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Files, Plus, Search, X } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { AssetGrid } from "@/components/important-files/AssetGrid"
import { AddAssetDialog } from "@/components/important-files/AddAssetDialog"
import { EditAssetDialog } from "@/components/important-files/EditAssetDialog"
import { DeleteAssetDialog } from "@/components/important-files/DeleteAssetDialog"
import { AssetViewerDialog } from "@/components/important-files/AssetViewerDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { uploadAsset } from "@/lib/assetUpload"
import {
  ASSET_FILTERS,
  ASSET_SEARCH_MAX_LENGTH,
  IMPORTANT_FILES_ENDPOINT,
  IMPORTANT_FILES_MESSAGES,
  SEARCH_DEBOUNCE_MS,
  type AssetFilterId,
} from "@/constants/importantFiles"
import type { Asset, AssetMetadataInput, AssetsPage, UploadProgress } from "@/types/importantFiles"

const chipClass = "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors"

export default function ImportantFilesClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [typedSearch, setTypedSearch] = useState("")
  const [search, setSearch] = useState("")
  const [type, setType] = useState<AssetFilterId>("all")
  const [isAdding, setIsAdding] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [viewing, setViewing] = useState<Asset | null>(null)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const isFetchingRef = useRef(false)
  const uploadRef = useRef<AbortController | null>(null)

  // Typing settles before the search runs, so a search is one request, not one per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typedSearch.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typedSearch])

  // The first batch: on arrival, whenever the search or the filter changes, and after a change
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (type !== "all") params.set("type", type)
    const query = params.toString()
    requestApi<AssetsPage>(`${IMPORTANT_FILES_ENDPOINT}${query ? `?${query}` : ""}`, { signal: controller.signal })
      .then(({ data }) => {
        setAssets(data.items)
        setNextCursor(data.nextCursor)
        setTotal(data.total)
        setListError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [search, type, reloadAttempt])

  // Starts the grid again from the newest file, keeping the current search and filter
  const reload = useCallback(() => {
    setIsLoading(true)
    setListError(null)
    setReloadAttempt((attempt) => attempt + 1)
  }, [])

  // A new search or filter starts from the first batch again, so nothing from the old one is kept
  const changeSearch = (value: string) => {
    setTypedSearch(value)
    setIsLoading(true)
  }
  const changeType = (next: AssetFilterId) => {
    if (next === type) return
    setType(next)
    setIsLoading(true)
  }

  // The batch after the last one, appended to what is already on screen
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursor) return
    isFetchingRef.current = true
    setIsLoadingMore(true)
    setListError(null)
    try {
      const params = new URLSearchParams({ cursor: nextCursor })
      if (search) params.set("search", search)
      if (type !== "all") params.set("type", type)
      const { data } = await requestApi<AssetsPage>(`${IMPORTANT_FILES_ENDPOINT}?${params.toString()}`)
      setAssets((current) => {
        // A file already on screen is never added twice, whatever changed meanwhile
        const seen = new Set(current.map((asset) => asset.id))
        return [...current, ...data.items.filter((asset) => !seen.has(asset.id))]
      })
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.moreFailed)
    } finally {
      isFetchingRef.current = false
      setIsLoadingMore(false)
    }
  }, [nextCursor, search, type])

  // The bytes go from the browser straight to storage; only the progress comes back here
  const startUpload = async (file: File, metadata: AssetMetadataInput) => {
    uploadRef.current?.abort()
    const controller = new AbortController()
    uploadRef.current = controller
    setProgress({ stage: "preparing", percent: 0, error: null })
    try {
      await uploadAsset(file, metadata, {
        onProgress: (percent) => setProgress((current) => (current ? { ...current, percent } : current)),
        onStage: (stage) => setProgress((current) => ({ stage, percent: current?.percent ?? 0, error: null })),
        signal: controller.signal,
      })
      setProgress({ stage: "done", percent: 100, error: null })
      setIsAdding(false)
      setProgress(null)
      setNotice(IMPORTANT_FILES_MESSAGES.created)
      reload()
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setProgress({ stage: "cancelled", percent: 0, error: null })
        return
      }
      setProgress({
        stage: "failed",
        percent: 0,
        error: error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.uploadFailed,
      })
    } finally {
      uploadRef.current = null
    }
  }

  const cancelUpload = () => uploadRef.current?.abort()

  const closeAdd = () => {
    if (progress && ["preparing", "uploading", "finishing"].includes(progress.stage)) return
    setIsAdding(false)
    setProgress(null)
  }

  const saveMetadata = async (input: AssetMetadataInput) => {
    if (!editing || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const { data } = await requestApi<Asset>(`${IMPORTANT_FILES_ENDPOINT}/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      // Only the details changed, so the file stays exactly where it is in the grid
      setAssets((current) => current.map((asset) => (asset.id === data.id ? data : asset)))
      setEditing(null)
      setNotice(IMPORTANT_FILES_MESSAGES.updated)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete || busyId) return
    setBusyId(pendingDelete.id)
    setDeleteError(null)
    try {
      await requestApi(`${IMPORTANT_FILES_ENDPOINT}/${pendingDelete.id}`, { method: "DELETE" })
      setAssets((current) => current.filter((asset) => asset.id !== pendingDelete.id))
      setTotal((count) => Math.max(0, count - 1))
      setPendingDelete(null)
      setNotice(IMPORTANT_FILES_MESSAGES.deleted)
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.deleteFailed)
    } finally {
      setBusyId(null)
    }
  }

  // A fresh signed link every time, so a link that has been sitting in the page cannot go stale
  const openLink = async (asset: Asset, download: boolean) => {
    try {
      const { data } = await requestApi<{ url: string }>(
        `${IMPORTANT_FILES_ENDPOINT}/${asset.id}/link${download ? "?download=1" : ""}`
      )
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.linkFailed)
    }
  }

  /** Copies what can really be copied: the text of a text file, or a PNG as an image. */
  const copyAsset = async (asset: Asset): Promise<boolean> => {
    try {
      if (asset.category === "text") {
        const { data } = await requestApi<{ text: string }>(`${IMPORTANT_FILES_ENDPOINT}/${asset.id}/text`)
        await navigator.clipboard.writeText(data.text)
        return true
      }
      if (asset.contentType === "image/png" && asset.previewUrl) {
        const blob = await (await fetch(asset.previewUrl)).blob()
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        return true
      }
      return false
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  const isFiltering = Boolean(search) || type !== "all"

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:h-full lg:p-8">
            {/* Page header */}
            <div className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <Files size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Important Files
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  The images, documents, videos and audio you want to hand, kept under names you choose.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <Plus size={16} aria-hidden="true" />
                Add File
              </button>
            </div>

            {/* Search and type filters */}
            <div className="flex shrink-0 flex-col gap-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
                <input
                  type="search"
                  value={typedSearch}
                  onChange={(event) => changeSearch(event.target.value)}
                  maxLength={ASSET_SEARCH_MAX_LENGTH}
                  placeholder="Search by name..."
                  aria-label="Search your files by name"
                  className="w-full rounded-xl border border-outline-variant bg-white py-2.5 pl-9 pr-9 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {typedSearch && (
                  <button
                    type="button"
                    onClick={() => changeSearch("")}
                    aria-label="Clear the search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-outline transition-colors hover:bg-surface-container hover:text-primary"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by file type">
                {ASSET_FILTERS.map((filter) => {
                  const Icon = filter.icon
                  const isActive = type === filter.id
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => changeType(filter.id as AssetFilterId)}
                      aria-pressed={isActive}
                      className={`${chipClass} ${
                        isActive
                          ? "bg-primary-container text-on-primary-container"
                          : "border border-outline-variant bg-white text-on-surface-variant hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      <Icon size={13} aria-hidden="true" />
                      {filter.label}
                    </button>
                  )
                })}
                <span className="ml-auto text-[11px] text-outline" aria-live="polite">
                  {total.toLocaleString()} {total === 1 ? "file" : "files"}
                  {isFiltering && " match"}
                </span>
              </div>
            </div>

            {notice && (
              <p role="status" className="shrink-0 rounded-xl bg-primary-container px-3 py-2 text-[12px] font-semibold text-on-primary-container">
                {notice}
              </p>
            )}

            <AssetGrid
              assets={assets}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasMore={Boolean(nextCursor)}
              error={listError}
              isFiltering={isFiltering}
              busyId={busyId}
              onRetry={reload}
              onLoadMore={loadMore}
              onView={setViewing}
              onDownload={(asset) => void openLink(asset, true)}
              onCopy={copyAsset}
              onEdit={(asset) => {
                setSaveError(null)
                setEditing(asset)
              }}
              onDelete={(asset) => {
                setDeleteError(null)
                setPendingDelete(asset)
              }}
            />
          </div>
        </main>
      </div>

      {isAdding && (
        <AddAssetDialog progress={progress} onUpload={startUpload} onCancelUpload={cancelUpload} onClose={closeAdd} />
      )}
      {viewing && (
        <AssetViewerDialog asset={viewing} onDownload={(asset) => void openLink(asset, true)} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <EditAssetDialog
          asset={editing}
          isSaving={isSaving}
          error={saveError}
          onSave={saveMetadata}
          onClose={() => setEditing(null)}
        />
      )}
      {pendingDelete && (
        <DeleteAssetDialog
          asset={pendingDelete}
          isDeleting={busyId === pendingDelete.id}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
