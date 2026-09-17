"use client"

import React from "react"
import { Pencil } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { RichTextView } from "@/components/ui/RichTextView"
import type { ImportantContent } from "@/types/importantContent"

interface ContentDetailsDialogProps {
  entry: ImportantContent
  onEdit: () => void
  onClose: () => void
}

const onDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/**
 * One entry in full: its name, type, when it was saved and changed, and the whole description
 * however long it is, with the formatting it was written with (bold, lists, headings, links...).
 * The table cuts a description to a few lines; this never does, and the dialog body scrolls
 * instead. Copy takes the description exactly as saved.
 */
export const ContentDetailsDialog: React.FC<ContentDetailsDialogProps> = ({ entry, onEdit, onClose }) => (
  <Modal
    title={entry.name}
    onClose={onClose}
    footer={
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <Pencil size={15} aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
        >
          Close
        </button>
      </div>
    }
  >
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Type</dt>
          <dd className="mt-1">
            <span className="inline-flex max-w-full truncate rounded-full bg-primary-fixed/70 px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
              {entry.type}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Saved</dt>
          <dd className="mt-1 text-on-surface-variant">{onDate(entry.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">Last changed</dt>
          <dd className="mt-1 text-on-surface-variant">{onDate(entry.updatedAt)}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-outline">
            Description
            {entry.description && (
              <span className="ml-2 font-medium normal-case tracking-normal">{entry.description.length.toLocaleString()} characters</span>
            )}
          </h3>
          {entry.description && <CopyButton text={entry.description} label={`Copy the description of ${entry.name}`} showLabel />}
        </div>
        {entry.description ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <RichTextView text={entry.description} />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-outline-variant p-4 text-[13px] text-outline">No description saved.</p>
        )}
      </section>
    </div>
  </Modal>
)
