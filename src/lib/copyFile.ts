"use client"

import { fetchWithRetry } from "@/lib/apiClient"

/**
 * Putting a stored file **itself** on the clipboard, so it pastes into Claude, WhatsApp or anywhere
 * else as the picture or the text rather than as a link.
 *
 * A browser lets a page write only two kinds of thing there: a PNG picture and plain text. So an
 * image of any type is drawn and copied as PNG, a text file is copied as its text, and nothing else
 * can be copied at all (no website can put a PDF, a video or a Word document on the clipboard),
 * which is why `copyKindOf` answers null for those and the page offers no Copy rather than one that
 * fails.
 */

export type CopyKind = "image" | "text"

/** What a file can be copied as, from its category (or its content type), or null when it can't be. */
export const copyKindOf = (category: string | null | undefined, contentType = ""): CopyKind | null => {
  if (category === "image" || contentType.startsWith("image/")) return "image"
  if (category === "text" || contentType.startsWith("text/")) return "text"
  return null
}

/** Any image the browser can show, drawn again as PNG, the one picture type a clipboard takes. */
async function asPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No canvas")
    context.drawImage(image, 0, 0)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("No PNG"))), "image/png"))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const contentOf = async (url: string, kind: CopyKind): Promise<Blob> => {
  const response = await fetchWithRetry(url)
  if (!response.ok) throw new Error(`Storage answered ${response.status}`)
  const blob = await response.blob()
  return kind === "image" ? asPng(blob) : new Blob([await blob.text()], { type: "text/plain" })
}

/**
 * Copies the file at `url` (a signed storage link) as `kind`. Answers whether it landed, so a
 * browser that refuses says so rather than looking as if it worked.
 */
export async function copyFileToClipboard(url: string, kind: CopyKind): Promise<boolean> {
  const type = kind === "image" ? "image/png" : "text/plain"
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    if (kind !== "text" || !navigator.clipboard?.writeText) return false
    try {
      await navigator.clipboard.writeText(await (await contentOf(url, kind)).text())
      return true
    } catch {
      return false
    }
  }
  try {
    // The download is handed to ClipboardItem rather than awaited first, because the permission a
    // click grants runs out while a large image is still downloading (Safari insists on this)
    await navigator.clipboard.write([new ClipboardItem({ [type]: contentOf(url, kind) })])
    return true
  } catch {
    // A browser that only takes a finished blob gets one
    try {
      await navigator.clipboard.write([new ClipboardItem({ [type]: await contentOf(url, kind) })])
      return true
    } catch {
      return false
    }
  }
}
