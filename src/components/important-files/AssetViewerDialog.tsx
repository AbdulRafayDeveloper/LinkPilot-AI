"use client"

import React, { useEffect, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { assetCategory } from "@/constants/importantFiles"
import type { Asset } from "@/types/importantFiles"
import { fetchWithRetry } from "@/lib/apiClient"

interface AssetViewerDialogProps {
  asset: Asset
  onDownload: (asset: Asset) => void
  onClose: () => void
}

/**
 * Opens one file as large as the screen allows, using what the browser already knows how to
 * show: an image, a video player, an audio player, the built-in PDF viewer, or the text itself.
 * Nothing here renders a document format by hand, and anything the browser cannot show offers
 * the download instead.
 */
export const AssetViewerDialog: React.FC<AssetViewerDialogProps> = ({ asset, onDownload, onClose }) => {
  const [text, setText] = useState<string | null>(null)
  // The dialog is mounted for one file, so what it starts as is decided from that file
  const [isLoadingText, setIsLoadingText] = useState(asset.category === "text" && Boolean(asset.previewUrl))

  // Text is the one kind the page shows itself, so it is fetched from the signed link
  useEffect(() => {
    if (asset.category !== "text" || !asset.previewUrl) return
    const controller = new AbortController()
    fetchWithRetry(asset.previewUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error("unavailable"))))
      .then((content) => setText(content))
      .catch(() => {
        if (!controller.signal.aborted) setText(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingText(false)
      })
    return () => controller.abort()
  }, [asset.category, asset.previewUrl])

  const { icon: CategoryIcon } = assetCategory(asset.category)

  return (
    <Modal
      title={asset.name}
      description={asset.description || undefined}
      onClose={onClose}
      size="large"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-all text-[11px] text-outline">{asset.originalName}</p>
          <button
            type="button"
            onClick={() => onDownload(asset)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
          >
            <Download size={16} aria-hidden="true" />
            Download
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {asset.previewUrl && asset.category === "image" && (
          // A signed storage link, not a static asset, so the img tag is the right tool here
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.previewUrl} alt={asset.name} className="max-h-full max-w-full rounded-xl object-contain" />
        )}

        {asset.previewUrl && asset.category === "video" && (
          <video src={asset.previewUrl} controls className="max-h-full max-w-full rounded-xl bg-black" aria-label={asset.name}>
            Your browser cannot play this video. Download it instead.
          </video>
        )}

        {asset.previewUrl && asset.category === "audio" && (
          <div className="flex w-full flex-col items-center gap-4 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary">
              <CategoryIcon size={28} aria-hidden="true" />
            </div>
            <audio src={asset.previewUrl} controls className="w-full max-w-lg" aria-label={asset.name}>
              Your browser cannot play this audio. Download it instead.
            </audio>
          </div>
        )}

        {asset.previewUrl && asset.category === "pdf" && (
          <iframe src={asset.previewUrl} title={asset.name} className="h-full w-full rounded-xl border border-outline-variant" />
        )}

        {asset.category === "text" &&
          (isLoadingText ? (
            <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
          ) : text !== null ? (
            <pre className="custom-scrollbar h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-outline-variant bg-surface-container-lowest p-4 font-code text-[13px] leading-relaxed text-on-surface">
              {text}
            </pre>
          ) : (
            <p className="text-sm text-on-surface-variant">This file couldn&apos;t be shown. Download it instead.</p>
          ))}

        {!asset.previewUrl && asset.category !== "text" && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
              <CategoryIcon size={24} aria-hidden="true" />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">
              Browsers can&apos;t show this kind of file. Download it to open it in the app it belongs to.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
