"use client"

import React, { useState } from "react"
import { Download, ExternalLink, FileWarning } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { PROJECT_FILE_MESSAGES } from "@/constants/clientProjectTasks"
import { canOpenInTab } from "@/lib/projectItems"
import { fileSize } from "./ProjectFilesField"
import type { ProjectFileView } from "@/types/clientProjectTasks"

/**
 * One file shown where it is: an image, a PDF, a video, a sound or a text file, over the whole
 * popup, with Download beside it.
 *
 * **What can be shown is decided on the server** (`previewTypeOf`): the link it signs carries the
 * type the browser should render it as, so a `.csv` and a `.md` read as text instead of saving
 * themselves. A Word document has no preview link at all, and says so rather than opening blank.
 *
 * **What the browser cannot decode still says so.** A TIFF, a `.mov` or an `.mkv` is a type the app
 * accepts and a browser may refuse: each viewer has its own `onError`, which swaps the picture for
 * one line explaining it and leaves Download exactly where it was.
 *
 * **An SVG is only ever rendered as an image.** It is a document that can carry script, so it is
 * never opened as a page: `canOpenInTab` (`lib/projectItems.ts`, where it can be read on its own)
 * keeps it out of "Open in a new tab", and an `<img>` never runs what is inside it.
 */

const FRAME = "h-full w-full rounded-xl border border-outline-variant bg-surface-container-lowest"

/** What is shown when the browser cannot decode a type the app accepts. */
const CannotShow: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-10 text-center">
    <FileWarning size={22} className="text-outline" aria-hidden="true" />
    <p className="max-w-md text-[13px] text-on-surface-variant">{message}</p>
  </div>
)

const Preview: React.FC<{ file: ProjectFileView }> = ({ file }) => {
  const [hasFailed, setHasFailed] = useState(false)
  if (!file.previewUrl) return <CannotShow message={PROJECT_FILE_MESSAGES.noPreview} />
  if (hasFailed) return <CannotShow message={PROJECT_FILE_MESSAGES.cannotShow} />

  switch (file.category) {
    case "image":
      return (
        <div className="flex h-full w-full items-center justify-center overflow-auto rounded-xl bg-surface-container-lowest p-2">
          {/* A short-lived signed link on the storage host, like every other stored image here, so a plain img */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.previewUrl} alt={file.name} onError={() => setHasFailed(true)} className="max-h-full max-w-full object-contain" />
        </div>
      )
    case "video":
      return (
        <video
          src={file.previewUrl}
          controls
          autoPlay
          onError={() => setHasFailed(true)}
          className="h-full w-full rounded-xl bg-black"
          aria-label={file.name}
        />
      )
    case "audio":
      return (
        <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface-container-lowest p-6">
          <audio src={file.previewUrl} controls autoPlay onError={() => setHasFailed(true)} className="w-full max-w-xl" aria-label={file.name} />
        </div>
      )
    case "text":
      // Sandboxed, so a text file is read as text and nothing in it can run
      return <iframe src={file.previewUrl} title={file.name} sandbox="" className={FRAME} />
    default:
      // A PDF, read by the browser's own viewer
      return <iframe src={file.previewUrl} title={file.name} className={FRAME} />
  }
}

export const FilePreviewDialog: React.FC<{ file: ProjectFileView; onClose: () => void }> = ({ file, onClose }) => (
  <Modal
    title={file.name}
    description={`${fileSize(file.size)} · ${file.contentType}`}
    onClose={onClose}
    size="large"
    footer={
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canOpenInTab(file) && (
          <a
            href={file.previewUrl ?? file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <ExternalLink size={15} aria-hidden="true" />
            {PROJECT_FILE_MESSAGES.openInTab}
          </a>
        )}
        <a
          href={file.url}
          download={file.name}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          <Download size={15} aria-hidden="true" />
          {PROJECT_FILE_MESSAGES.download}
        </a>
      </div>
    }
  >
    <div className="min-h-0 flex-1">
      <Preview file={file} />
    </div>
  </Modal>
)
