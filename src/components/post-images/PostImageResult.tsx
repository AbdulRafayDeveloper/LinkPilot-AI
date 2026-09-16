"use client"

import React, { useState } from "react"
import { Check, Copy, Download, ImagePlus, Loader2 } from "lucide-react"
import { ResultCard } from "@/components/ui/ResultCard"
import { getPoseLabel, POST_IMAGES_MESSAGES } from "@/constants/postImages"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import type { PostImage } from "@/types/postImages"

interface PostImageResultProps {
  status: GenerationStatus
  image: PostImage | null
  error: string | null
  onRetry: () => void
  onDownload: (image: PostImage) => void
}

/**
 * Copies the picture itself, not a link to it. Only PNG can go on the clipboard in the browsers
 * that support it at all, which is what the module makes, and a browser that refuses says so
 * rather than looking as if it worked.
 */
export async function copyImageToClipboard(url: string): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false
  try {
    // The fetch is handed to ClipboardItem rather than awaited first, because the permission a
    // click grants runs out while a megabyte of image is still downloading
    await navigator.clipboard.write([new ClipboardItem({ "image/png": fetch(url).then((response) => response.blob()) })])
    return true
  } catch {
    // A browser that only takes a finished blob gets one
    try {
      const blob = await (await fetch(url)).blob()
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      return true
    } catch {
      return false
    }
  }
}

/** The finished image, with the two things to do with it and what it was made from. */
export const PostImageResult: React.FC<PostImageResultProps> = ({ status, image, error, onRetry, onDownload }) => {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle")

  const copy = async () => {
    if (!image?.imageUrl) return
    setCopyState("copying")
    const copied = await copyImageToClipboard(image.imageUrl)
    setCopyState(copied ? "copied" : "failed")
    setTimeout(() => setCopyState("idle"), 2500)
  }

  return (
    <ResultCard
      title="Your post image"
      status={status === "success" && !image ? "idle" : status}
      error={error}
      onRetry={onRetry}
      idleIcon={ImagePlus}
      idleText="Say what the post is about, pick a photo if you want one in it, and the image lands here."
      loadingText="Drawing your image. This takes up to a minute..."
      headerAction={
        image && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copy}
              disabled={copyState === "copying"}
              aria-label="Copy the image"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
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
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Can't copy" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => onDownload(image)}
              aria-label="Download the image"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
            >
              <Download size={14} aria-hidden="true" />
              Download
            </button>
          </div>
        )
      }
    >
      {image && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {image.imageUrl && (
            // A signed storage link, not a static asset, so the img tag is the right tool here
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.imageUrl}
              alt={`Post image for ${image.postContent.slice(0, 60)}`}
              className="max-h-[520px] w-full rounded-xl border border-outline-variant object-contain"
            />
          )}
          {copyState === "failed" && (
            <p role="alert" className="rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
              {POST_IMAGES_MESSAGES.copyFailed}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-outline">
            <span>
              {image.width} x {image.height}
            </span>
            <span>·</span>
            <span>{image.model}</span>
            {image.assetName && (
              <>
                <span>·</span>
                <span>
                  {image.assetName}
                  {image.pose ? `, ${getPoseLabel(image.pose).toLowerCase()}` : ""}
                </span>
              </>
            )}
            <span className="ml-auto flex items-center gap-1">
              {image.colors.map((color) => (
                <span
                  key={color}
                  title={color}
                  style={{ backgroundColor: color }}
                  className="h-3 w-3 rounded-full border border-outline-variant"
                />
              ))}
            </span>
          </div>
        </div>
      )}
    </ResultCard>
  )
}
