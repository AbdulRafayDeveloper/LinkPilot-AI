"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronRight, ImageOff, X } from "lucide-react"
import { RichTextView } from "@/components/ui/RichTextView"
import type { TaskImageView } from "@/types/taskAttachment"

interface TaskDetailsViewProps {
  description: string
  images: TaskImageView[]
  // The task's own line, so the images have something to be described as
  label: string
  // Starts open where the details are the point of the view rather than an extra (nowhere today)
  defaultOpen?: boolean
}

/** One image as a thumbnail, opening full size; a link that fails says so rather than showing a broken image. */
const ImageThumbnail: React.FC<{ image: TaskImageView; alt: string; onOpen: () => void }> = ({ image, alt, onOpen }) => {
  const [hasFailed, setHasFailed] = useState(false)
  if (hasFailed) {
    return (
      <li className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-outline-variant text-center text-[9px] text-outline">
        <ImageOff size={13} aria-hidden="true" />
        Couldn&apos;t load
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          // Inside a task's row, a click on an image never ticks the task
          event.preventDefault()
          event.stopPropagation()
          onOpen()
        }}
        aria-label={`Open ${alt} full size`}
        className="block h-16 w-16 overflow-hidden rounded-lg border border-outline-variant transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={alt} loading="lazy" onError={() => setHasFailed(true)} className="h-full w-full object-cover" />
      </button>
    </li>
  )
}

/**
 * The description and images saved on a task, under the task's own line. Shown the same way
 * wherever a task is read: Daily Tasks, the manager's plan editor, its history and the employee's
 * own link. The description is formatted text (bold, lists, links read as they were written) and
 * the images are thumbnails that open full size.
 *
 * **They are folded away until they are asked for**, like a task's subtasks, so a list of tasks reads
 * as a list of lines: the row shows a Details button saying what is there (and how many images), and
 * one click opens it. Nothing is remembered between visits, so a list always opens short.
 *
 * The images are plain img elements, like every other stored image here (Important Files, Post Image
 * Creator), because each link is a short-lived signed one on the storage host rather than something
 * next/image can be pointed at.
 */
export const TaskDetailsView: React.FC<TaskDetailsViewProps> = ({ description, images, label, defaultOpen = false }) => {
  const [open, setOpen] = useState<TaskImageView | null>(null)
  const [isShown, setIsShown] = useState(defaultOpen)
  if (!description && images.length === 0) return null

  const what = [description ? "description" : null, images.length > 0 ? `${images.length} ${images.length === 1 ? "image" : "images"}` : null]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          // Inside a task's row, opening the details never ticks the task or starts a drag
          event.preventDefault()
          event.stopPropagation()
          setIsShown((shown) => !shown)
        }}
        aria-expanded={isShown}
        aria-label={`${isShown ? "Hide" : "Show"} the details of ${label}`}
        className="inline-flex w-fit items-center gap-1 rounded-md py-0.5 pr-1.5 text-[11px] font-semibold text-outline transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {isShown ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        {isShown ? "Hide details" : `Details (${what})`}
      </button>

      {isShown && description && <RichTextView text={description} fontSize={13} className="[overflow-wrap:anywhere]" />}

      {isShown && images.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Images on ${label}`}>
          {images.map((image, index) => (
            <ImageThumbnail key={image.assetId} image={image} alt={`image ${index + 1} on ${label}`} onOpen={() => setOpen(image)} />
          ))}
        </ul>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image on ${label}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setOpen(null)
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(null)
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close the image"
            className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 text-on-surface transition-colors hover:bg-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt={`Image on ${label}`} className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
