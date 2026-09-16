"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  Files,
  Loader2,
  Pencil,
  RefreshCw,
  SearchX,
  Trash2,
} from "lucide-react"
import { formatBytes } from "@/components/important-files/AddAssetDialog"
import {
  ASSET_DESCRIPTION_PREVIEW_LENGTH,
  IMPORTANT_FILES_MESSAGES,
  assetCategory,
  getCategoryLabel,
} from "@/constants/importantFiles"
import type { Asset } from "@/types/importantFiles"

interface AssetGridProps {
  assets: Asset[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  // True while a search or a filter is in effect, so "nothing found" reads differently from "nothing saved"
  isFiltering: boolean
  busyId: string | null
  onRetry: () => void
  onLoadMore: () => void
  onView: (asset: Asset) => void
  onDownload: (asset: Asset) => void
  onCopy: (asset: Asset) => Promise<boolean>
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
}

const actionButton =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

const savedAt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

/**
 * Whether this file can really be put on the clipboard by this browser. Text can, and a PNG can
 * where the Clipboard API takes images. Nothing else can, so nothing else offers Copy rather
 * than pretending and failing.
 */
export function canCopy(asset: Asset): boolean {
  if (asset.category === "text") return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText)
  if (asset.contentType === "image/png") {
    return typeof window !== "undefined" && typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write)
  }
  return false
}

const CenteredState: React.FC<{ icon: React.ReactNode; text: string; children?: React.ReactNode; role?: "alert" | "status" }> = ({
  icon,
  text,
  children,
  role,
}) => (
  <div role={role} className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
    {icon}
    <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">{text}</p>
    {children}
  </div>
)

/**
 * One file: what it looks like where that is possible, the name it was given, and everything
 * that can be done with it. The description stays folded away until it is asked for, so a long
 * one never turns the card into a wall.
 */
const AssetCard: React.FC<{
  asset: Asset
  isBusy: boolean
  onView: (asset: Asset) => void
  onDownload: (asset: Asset) => void
  onCopy: (asset: Asset) => Promise<boolean>
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
}> = ({ asset, isBusy, onView, onDownload, onCopy, onEdit, onDelete }) => {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle")
  const { icon: CategoryIcon } = assetCategory(asset.category)
  const isCut = asset.description.length > ASSET_DESCRIPTION_PREVIEW_LENGTH
  const shownDescription =
    isCut && !isDescriptionOpen ? `${asset.description.slice(0, ASSET_DESCRIPTION_PREVIEW_LENGTH)}…` : asset.description

  const copy = async () => {
    setCopyState("copying")
    const copied = await onCopy(asset)
    setCopyState(copied ? "copied" : "failed")
    setTimeout(() => setCopyState("idle"), 2000)
  }

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm transition-opacity ${
        isBusy ? "opacity-50" : ""
      }`}
    >
      {/* What the file looks like, for the kinds that look like anything */}
      <button
        type="button"
        onClick={() => onView(asset)}
        aria-label={`View ${asset.name}`}
        className="group relative flex h-36 w-full items-center justify-center overflow-hidden border-b border-outline-variant bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {asset.category === "image" && asset.previewUrl ? (
          // A signed storage link, not a static asset, so the img tag is the right tool here
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.previewUrl} alt={asset.name} loading="lazy" className="h-full w-full object-cover" />
        ) : asset.category === "video" && asset.previewUrl ? (
          <video src={asset.previewUrl} preload="metadata" muted className="h-full w-full object-cover" aria-hidden="true" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-primary">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5">
              <CategoryIcon size={22} aria-hidden="true" />
            </div>
            <span className="text-[11px] font-semibold text-outline">{getCategoryLabel(asset.category)}</span>
          </div>
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-on-surface/40 text-[12px] font-semibold text-white group-hover:flex group-focus-visible:flex">
          <Eye size={16} className="mr-1.5" aria-hidden="true" />
          View
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-sm font-bold text-on-surface">{asset.name}</h3>
          <span className="shrink-0 text-[11px] text-outline">{savedAt(asset.updatedAt)}</span>
        </div>

        <p className="text-[11px] text-outline">
          {getCategoryLabel(asset.category)} · {formatBytes(asset.size)}
        </p>

        {asset.description && (
          <>
            <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-on-surface-variant">
              {shownDescription}
            </p>
            {isCut && (
              <button
                type="button"
                onClick={() => setIsDescriptionOpen((open) => !open)}
                aria-expanded={isDescriptionOpen}
                className={`${actionButton} self-start text-outline hover:bg-surface-container hover:text-primary`}
              >
                {isDescriptionOpen ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                {isDescriptionOpen ? "Show less" : "Show description"}
              </button>
            )}
          </>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-outline-variant/70 pt-2">
          <button
            type="button"
            onClick={() => onView(asset)}
            disabled={isBusy}
            aria-label={`View ${asset.name}`}
            className={`${actionButton} text-outline hover:bg-surface-container hover:text-primary`}
          >
            <Eye size={13} aria-hidden="true" />
            View
          </button>
          <button
            type="button"
            onClick={() => onDownload(asset)}
            disabled={isBusy}
            aria-label={`Download ${asset.name}`}
            className={`${actionButton} text-outline hover:bg-surface-container hover:text-primary`}
          >
            <Download size={13} aria-hidden="true" />
            Download
          </button>
          {canCopy(asset) && (
            <button
              type="button"
              onClick={copy}
              disabled={isBusy || copyState === "copying"}
              aria-label={`Copy ${asset.name}`}
              className={`${actionButton} ${
                copyState === "failed" ? "text-error" : "text-outline hover:bg-surface-container hover:text-primary"
              }`}
            >
              {copyState === "copying" ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : copyState === "copied" ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Couldn't copy" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(asset)}
            disabled={isBusy}
            aria-label={`Edit ${asset.name}`}
            className={`${actionButton} ml-auto text-outline hover:bg-surface-container hover:text-primary`}
          >
            <Pencil size={13} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset)}
            disabled={isBusy}
            aria-label={`Delete ${asset.name}`}
            className={`${actionButton} text-outline hover:bg-error/5 hover:text-error`}
          >
            {isBusy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

/**
 * The stored files as cards, newest first. The next batch loads as the grid is scrolled, so the
 * page never holds more than what has been scrolled to.
 */
export const AssetGrid: React.FC<AssetGridProps> = ({
  assets,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isFiltering,
  busyId,
  onRetry,
  onLoadMore,
  onView,
  onDownload,
  onCopy,
  onEdit,
  onDelete,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // The batch after this one loads when the end of the grid comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || isLoadingMore || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      // Starts the next batch a little before the end of the grid is reached
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, error, onLoadMore])

  if (error && assets.length === 0) {
    return (
      <CenteredState
        role="alert"
        icon={
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
        }
        text={error}
      >
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </button>
      </CenteredState>
    )
  }

  if (isLoading && assets.length === 0) {
    return (
      <CenteredState
        role="status"
        icon={<Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />}
        text="Loading your files..."
      />
    )
  }

  if (assets.length === 0) {
    return (
      <CenteredState
        icon={
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            {isFiltering ? <SearchX size={20} aria-hidden="true" /> : <Files size={20} aria-hidden="true" />}
          </div>
        }
        text={isFiltering ? IMPORTANT_FILES_MESSAGES.noResults : IMPORTANT_FILES_MESSAGES.empty}
      />
    )
  }

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isBusy={busyId === asset.id}
            onView={onView}
            onDownload={onDownload}
            onCopy={onCopy}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>

      {/* Scrolling this into view loads the next batch */}
      <div ref={sentinelRef} className="pt-4 text-center text-[11px] text-outline" aria-live="polite">
        {error ? (
          <span role="alert" className="flex items-center justify-center gap-2 text-error">
            {error}
            <button type="button" onClick={onRetry} className="font-semibold underline hover:no-underline">
              Try again
            </button>
          </span>
        ) : isLoadingMore ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            Loading more...
          </span>
        ) : hasMore ? (
          <span>Scroll for more</span>
        ) : (
          <span>That is everything.</span>
        )}
      </div>
    </div>
  )
}
