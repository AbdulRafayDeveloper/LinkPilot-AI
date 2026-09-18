"use client"

import React, { useState } from "react"
import { ImageOff, X } from "lucide-react"
import type { TaskImageView } from "@/types/taskAttachment"

interface TaskDetailsViewProps {
  description: string
  image: TaskImageView | null
  // The task's own line, so the image has something to be described as
  label: string
}

/**
 * The description and image saved on a task, under the task's own line. Shown the same way
 * wherever a task is read: Daily Tasks, the manager's plan editor, its history and the
 * employee's own link.
 *
 * The image is a plain img, like every other stored image here (Important Files, Post Image
 * Creator), because the link is a short-lived signed one on the storage host rather than
 * something next/image can be pointed at. Clicking it opens it full size.
 */
export const TaskDetailsView: React.FC<TaskDetailsViewProps> = ({ description, image, label }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  if (!description && !image) return null

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {description && (
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">{description}</p>
      )}

      {image &&
        (hasFailed ? (
          <p className="inline-flex items-center gap-1.5 text-[11px] text-outline">
            <ImageOff size={12} aria-hidden="true" />
            That image could not be loaded.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={`Open the image on "${label}" full size`}
            className="w-fit overflow-hidden rounded-xl border border-outline-variant transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={`Image on ${label}`}
              loading="lazy"
              onError={() => setHasFailed(true)}
              className="max-h-40 w-auto max-w-full object-contain"
            />
          </button>
        ))}

      {isOpen && image && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image on ${label}`}
          onClick={() => setIsOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsOpen(false)
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close the image"
            className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 text-on-surface transition-colors hover:bg-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={`Image on ${label}`} className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
