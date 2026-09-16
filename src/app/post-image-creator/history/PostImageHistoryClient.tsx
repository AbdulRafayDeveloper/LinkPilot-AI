"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  GalleryHorizontalEnd,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { copyImageToClipboard } from "@/components/post-images/PostImageResult"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { POST_IMAGES_ENDPOINT, POST_IMAGES_MESSAGES, getPoseLabel } from "@/constants/postImages"
import type { PostImage, PostImagesPage } from "@/types/postImages"

const madeAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const actionButton =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

/**
 * Every post image made so far, newest first, with what it was made from. Copy and download work
 * here as well as on the page that made the image, and the detail view shows the settings that
 * were in force at the time rather than today's defaults.
 */
export default function PostImageHistoryClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [images, setImages] = useState<PostImage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [detail, setDetail] = useState<PostImage | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [failedCopyId, setFailedCopyId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const isFetchingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<PostImagesPage>(POST_IMAGES_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setImages(data.items)
        setNextCursor(data.nextCursor)
        setTotal(data.total)
        setListError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [reloadAttempt])

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursor) return
    isFetchingRef.current = true
    setIsLoadingMore(true)
    try {
      const { data } = await requestApi<PostImagesPage>(`${POST_IMAGES_ENDPOINT}?cursor=${encodeURIComponent(nextCursor)}`)
      setImages((current) => {
        // An image already on screen is never added twice, whatever changed meanwhile
        const seen = new Set(current.map((image) => image.id))
        return [...current, ...data.items.filter((image) => !seen.has(image.id))]
      })
      setNextCursor(data.nextCursor)
      setTotal(data.total)
      setListError(null)
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.moreFailed)
    } finally {
      isFetchingRef.current = false
      setIsLoadingMore(false)
    }
  }, [nextCursor])

  // The next batch loads when the end of the gallery comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor || isLoadingMore || listError) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    }, { rootMargin: "300px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, isLoadingMore, listError, loadMore])

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
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.loadFailed)
    }
  }

  const remove = async (image: PostImage) => {
    setBusyId(image.id)
    try {
      await requestApi(`${POST_IMAGES_ENDPOINT}/${image.id}`, { method: "DELETE" })
      setImages((current) => current.filter((entry) => entry.id !== image.id))
      setTotal((count) => Math.max(0, count - 1))
      setDetail(null)
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.loadFailed)
    } finally {
      setBusyId(null)
    }
  }

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
            <div className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <GalleryHorizontalEnd size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Generated Posts
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Every post image you have made, with what it was made from.
                </p>
              </div>
              <Link
                href="/post-image-creator"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:shrink-0"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to the creator
              </Link>
            </div>

            <p className="shrink-0 text-[11px] text-outline" aria-live="polite">
              {total.toLocaleString()} {total === 1 ? "image" : "images"}
            </p>

            {listError && images.length === 0 ? (
              <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{listError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true)
                    setListError(null)
                    setReloadAttempt((attempt) => attempt + 1)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : isLoading ? (
              <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your images...
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <GalleryHorizontalEnd size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{POST_IMAGES_MESSAGES.emptyHistory}</p>
              </div>
            ) : (
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {images.map((image) => (
                    <li key={image.id} className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm">
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

                <div ref={sentinelRef} className="pt-4 text-center text-[11px] text-outline" aria-live="polite">
                  {isLoadingMore ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      Loading more...
                    </span>
                  ) : nextCursor ? (
                    <span>Scroll for more</span>
                  ) : (
                    <span>That is everything.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

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
