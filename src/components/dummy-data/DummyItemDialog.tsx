"use client"

import React from "react"
import { Pencil, Play } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { toolForKind, type DummyTool } from "@/lib/dummyTools"
import { DUMMY_DATA_KINDS, type DummyDataKind } from "@/constants/dummyData"
import type { DummyItem } from "@/types/dummyData"

interface DummyItemDialogProps {
  kind: DummyDataKind
  item: DummyItem
  /**
   * The tool being tested, which is the one Use offers. A kind several tools share is read under
   * whichever of them the admin chose, so the popup never carries a row of tool buttons; left out,
   * it falls back to the first tool the kind names.
   */
  tool?: DummyTool
  // Opens the tool at this address with the item already in its inputs
  onUse: (href: string) => void
  onEdit: () => void
  onClose: () => void
}

/**
 * One piece of sample data, read in full: every field as it is saved, each with its own Copy, and
 * one **Use in <tool>** for the tool it is being read under. Using it closes the popup and opens
 * that tool with the fields already in place, so the admin never pastes sample data by hand.
 */
export const DummyItemDialog: React.FC<DummyItemDialogProps> = ({ kind, item, tool, onUse, onEdit, onClose }) => {
  const { fields, item: noun } = DUMMY_DATA_KINDS[kind]
  const opens = tool ?? toolForKind(kind)

  return (
    <Modal
      title={item.name}
      description={`Sample ${noun}. Use it to open ${opens ? opens.title : "the tool"} with this already filled in.`}
      onClose={onClose}
      size="large"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
          {opens && (
            <button
              type="button"
              onClick={() => onUse(opens.href)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Play size={15} aria-hidden="true" />
              Use in {opens.title}
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {fields.map((field) => {
          const value = item.fields[field.key] ?? ""
          return (
            <section key={field.key} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline">{field.label}</h3>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-outline">{value.length.toLocaleString()} characters</span>
                  {value && <CopyButton text={value} label={`Copy the ${field.label.toLowerCase()}`} showLabel />}
                </span>
              </div>
              {value ? (
                <pre className="custom-scrollbar max-h-[280px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-container-lowest p-3 font-code text-[12px] leading-relaxed text-on-surface-variant">
                  {value}
                </pre>
              ) : (
                <p className="rounded-xl bg-surface-container-lowest p-3 text-[12px] text-outline">Nothing saved for this field.</p>
              )}
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
