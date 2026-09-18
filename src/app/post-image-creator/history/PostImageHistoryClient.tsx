"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  GalleryHorizontalEnd,
  Info,
  Loader2,
  RefreshCw,
  SquarePlus,
  Trash2,
} from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { DateRangeFilters, FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { LoadMore } from "@/components/history/LoadMore"
import { copyImageToClipboard } from "@/components/post-images/PostImageResult"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useCursorList } from "@/hooks/useCursorList"
import { useRowSelection } from "@/hooks/useRowSelection"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import { IMAGE_SIZES, PHOTO_FILTER_OPTIONS, POST_IMAGES_ENDPOINT, POST_IMAGES_MESSAGES, getPoseLabel } from "@/constants/postImages"
import type { PostImage } from "@/types/postImages"

const madeAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const actionButton =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

interface FilterState {
  search: string
  size: string
  photo: string
  fromDay: string
  toDay: string
}

const NO_FILTERS: FilterState = { search: "", size: "", photo: "", fromDay: "", toDay: "" }

const idOf = (image: PostImage) => image.id

/**
 * Every post image made so far, newest first, 50 at a time and loaded as the gallery scrolls. The
 * search, shape, photo and date filters run on the server. Copy and download work here as well as
 * on the page that made the image, and the detail view shows the settings that were in force at
 * the time rather than today's defaults.
 */
export default function PostImageHistoryClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS)
  const [actionError, setActionError] = useState<string | null>(null)
  const [detail, setDetail] = useState<PostImage | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [failedCopyId, setFailedCopyId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Deleting several at once: which delete is waiting to be confirmed, and whether it is running
  const [confirmingMany, setConfirmingMany] = useState<"picked" | "all" | null>(null)
  const [isDeletingMany, setIsDeletingMany] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()

  // Typing settles before the gallery is asked for again, and an emptied search box counts at once
  const settledSearch = useDebouncedValue(filters.search.trim(), HISTORY_DEBOUNCE_MS)
  const badDateRange = isBackwardsRange(filters.fromDay, filters.toDay)
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)
  const params = new URLSearchParams()
  if (filters.search.trim() && settledSearch) params.set("search", settledSearch)
  if (filters.size) params.set("size", filters.size)
  if (filters.photo) params.set("photo", filters.photo)
  appendDayRange(params, filters.fromDay, filters.toDay)

  const list = useCursorList<PostImage>({
    endpoint: POST_IMAGES_ENDPOINT,
    query: params.toString(),
    enabled: !badDateRange,
    loadFailed: POST_IMAGES_MESSAGES.loadFailed,
    idOf,
  })
  const images = list.items
  const selection = useRowSelection(images.map((image) => image.id))
  const updateFilter = (key: keyof FilterState, value: string) => setFilters((current) => ({ ...current, [key]: value }))

  /**
   * Deletes the ticked images, or every image the filters cover, in one call. Each picture goes from
   * storage before its record, so an image that cannot be removed stays listed and the answer says
   * so. Final, and only from the confirmation.
   */
  const deleteMany = async (which: "picked" | "all") => {
    if (isDeletingMany) return
    setIsDeletingMany(true)
    setActionError(null)
    try {
      const query = params.toString()
      await requestApi<{ deleted: number; failed: number }>(`${POST_IMAGES_ENDPOINT}${query ? `?${query}` : ""}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "picked" ? { ids: [...selection.pickedIds] } : { all: true }),
      })
      selection.clear()
      setConfirmingMany(null)
      list.retry()
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : POST_IMAGES_MESSAGES.deleteFailed)
      setConfirmingMany(null)
    } finally {
      setIsDeletingMany(false)
    }
  }

  const copy = async (image: PostImage) => {
    if (!image.imageUrl) return
    setBusyId(image.id)
    const copied = await copyImageToClipboard(image.imageUrl)
    setBusyId(null)
    if (copied) {
      setCopiedId(image.id)
      setTimeout(() => setCopiedId(null), 2000)
    } else {
      setFailedCopyId(image.id)
      setTimeout(() => setFailedCopyId(null), 3000)
    }
  }

  const download = async (image: PostImage) => {
    try {
      const { data } = await requestApi<{ url: string }>(`${POST_IMAGES_ENDPOINT}/${image.id}/link?download=1`)
      window.open(data.url, "_blank", "noopener,noreferrer")
      setActionError(null)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.loadFailed)
    }
  }

  const remove = async (image: PostImage) => {
    setBusyId(image.id)
    try {
      await requestApi(`${POST_IMAGES_ENDPOINT}/${image.id}`, { method: "DELETE" })
      list.update((current) => current.filter((entry) => entry.id !== image.id), -1)
      setDetail(null)
      setActionError(null)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.loadFailed)
    } finally {
      setBusyId(null)
    }
  }

  const imageCount = (total: number) => `${total.toLocaleString()} ${total === 1 ? "image" : "images"}`

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
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <GalleryHorizontalEnd size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Generated Post Images
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Every post image you have made, with what it was made from.
                </p>
              </div>
              <Link
                href="/post-image-creator"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <SquarePlus size={16} aria-hidden="true" />
                Create New Image
              </Link>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]"
              canClear={hasFilters}
              onClear={() => setFilters(NO_FILTERS)}
              summary={
                badDateRange
                  ? HISTORY_MESSAGES.badDateRange
                  : list.hasAnswer
                    ? `Showing ${images.length.toLocaleString()} of ${imageCount(list.total)}`
                    : "Loading your images..."
              }
            >
              <SearchFilter value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder="Post content or photo name" />
              <SelectFilter label="Shape" allLabel="All shapes" value={filters.size} options={IMAGE_SIZES} onChange={(value) => updateFilter("size", value)} />
              <SelectFilter label="Photo" allLabel="With or without" value={filters.photo} options={PHOTO_FILTER_OPTIONS} onChange={(value) => updateFilter("photo", value)} />
              <DateRangeFilters
                fromLabel="Made from"
                toLabel="Made to"
                fromDay={filters.fromDay}
                toDay={filters.toDay}
                onFromChange={(day) => updateFilter("fromDay", day)}
                onToChange={(day) => updateFilter("toDay", day)}
              />
            </FilterPanel>

            {list.hasAnswer && list.total > 0 && (
              <BulkDeleteBar
                pickedCount={selection.pickedIds.size}
                total={list.total}
                noun={{ one: "image", many: "images" }}
                hasFilters={hasFilters}
                isBusy={isDeletingMany}
                onDeletePicked={() => setConfirmingMany("picked")}
                onDeleteAll={() => setConfirmingMany("all")}
                onClear={selection.clear}
              />
            )}

            {actionError && (
              <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                {actionError}
              </p>
            )}

            {list.error && !list.hasAnswer ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{list.error}</p>
                <button
                  type="button"
                  onClick={list.retry}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !list.hasAnswer ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your images...
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <GalleryHorizontalEnd size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">
                  {hasFilters ? "No images match these filters." : POST_IMAGES_MESSAGES.emptyHistory}
                </p>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${list.isLoading ? "opacity-60" : ""}`} aria-busy={list.isLoading}>
                {list.error && (
                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                    {list.error}
                  </p>
                )}
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {images.map((image) => (
                    <li
                      key={image.id}
                      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
                        selection.isPicked(image.id) ? "border-primary" : "border-outline-variant"
                      }`}
                    >
                      {/* Ticking an image picks it for deleting several at once */}
                      <label className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 shadow-sm">
                        <input
                          type="checkbox"
                          checked={selection.isPicked(image.id)}
                          disabled={isDeletingMany}
                          onChange={(event) => selection.pick(image.id, (event.nativeEvent as MouseEvent).shiftKey)}
                          aria-label={`Pick this image`}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setDetail(image)}
                        aria-label={`Open the details of the image made on ${madeAt(image.createdAt)}`}
                        className="block aspect-square w-full overflow-hidden border-b border-outline-variant bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {image.imageUrl && (
                          // A signed storage link, not a static asset
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image.imageUrl} alt={image.postContent.slice(0, 80)} loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </button>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <p className="line-clamp-2 text-[12px] leading-relaxed text-on-surface">{image.postContent}</p>
                        <p className="text-[11px] text-outline">
                          {madeAt(image.createdAt)}
                          {image.assetName ? ` · ${image.assetName}` : ""}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-outline-variant/70 pt-2">
                          <button
                            type="button"
                            onClick={() => copy(image)}
                            disabled={busyId === image.id}
                            aria-label="Copy this image"
                            className={`${actionButton} ${
                              failedCopyId === image.id ? "text-error" : "text-outline hover:bg-surface-container hover:text-primary"
                            }`}
                          >
                            {busyId === image.id ? (
                              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                            ) : copiedId === image.id ? (
                              <Check size={13} aria-hidden="true" />
                            ) : (
                              <Copy size={13} aria-hidden="true" />
                            )}
                            {copiedId === image.id ? "Copied" : failedCopyId === image.id ? "Can't copy" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => download(image)}
                            aria-label="Download this image"
                            className={`${actionButton} text-outline hover:bg-surface-container hover:text-primary`}
                          >
                            <Download size={13} aria-hidden="true" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetail(image)}
                            aria-label="See how this image was made"
                            className={`${actionButton} ml-auto text-outline hover:bg-surface-container hover:text-primary`}
                          >
                            <Info size={13} aria-hidden="true" />
                            Details
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <LoadMore
                  hasMore={list.hasMore}
                  isLoadingMore={list.isLoadingMore}
                  error={list.moreError}
                  onLoadMore={list.loadMore}
                  doneText="That is everything."
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {confirmingMany && (
        <ConfirmBulkDelete
          count={confirmingMany === "picked" ? selection.pickedIds.size : list.total}
          noun={{ one: "image", many: "images" }}
          alsoGoes="The picture is removed from storage as well; anything that cannot be removed stays listed."
          isDeleting={isDeletingMany}
          onConfirm={() => void deleteMany(confirmingMany)}
          onClose={() => setConfirmingMany(null)}
        />
      )}
      {detail && (
        <Modal
          title="How this image was made"
          description={madeAt(detail.createdAt)}
          onClose={() => setDetail(null)}
          size="large"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => remove(detail)}
                disabled={busyId === detail.id}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-[12px] font-semibold text-outline transition-colors hover:border-error/40 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete this image
              </button>
              <button
                type="button"
                onClick={() => download(detail)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
              >
                <Download size={16} aria-hidden="true" />
                Download
              </button>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {detail.imageUrl && (
              // A signed storage link, not a static asset
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.imageUrl} alt={detail.postContent.slice(0, 80)} className="w-full rounded-xl border border-outline-variant object-contain" />
            )}
            <dl className="flex flex-col gap-3 text-[12px]">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Post content</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-on-surface">{detail.postContent}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Colours used</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {detail.colors.length === 0 ? (
                    <span className="text-on-surface-variant">None set at the time</span>
                  ) : (
                    detail.colors.map((color) => (
                      <span key={color} className="flex items-center gap-1 rounded-lg bg-surface-container-lowest px-2 py-1 font-code text-[11px]">
                        <span style={{ backgroundColor: color }} className="h-3 w-3 rounded-full border border-outline-variant" aria-hidden="true" />
                        {color}
                      </span>
                    ))
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Name used</dt>
                  <dd className="mt-0.5 text-on-surface">{detail.displayName || "None"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Photo</dt>
                  <dd className="mt-0.5 text-on-surface">
                    {detail.assetName ? `${detail.assetName}${detail.pose ? `, ${getPoseLabel(detail.pose).toLowerCase()}` : ""}` : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Model</dt>
                  <dd className="mt-0.5 font-code text-on-surface">{detail.model}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Size</dt>
                  <dd className="mt-0.5 text-on-surface">
                    {detail.width} x {detail.height}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">The instructions it was drawn from</dt>
                <dd className="custom-scrollbar mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-outline-variant bg-surface-container-lowest p-3 font-code text-[11px] leading-relaxed text-on-surface-variant">
                  {detail.prompt}
                </dd>
              </div>
            </dl>
          </div>
        </Modal>
      )}
    </div>
  )
}
