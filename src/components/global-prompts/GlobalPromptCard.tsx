"use client"

import React from "react"
import { FilePenLine, UserRound, WandSparkles, type LucideIcon } from "lucide-react"
import { getGlobalPromptUsage, type GlobalPromptId } from "@/constants/globalPrompts"

const PROMPT_ICONS: Record<GlobalPromptId, LucideIcon> = {
  "rafay-profile": UserRound,
  humanization: WandSparkles,
}

interface GlobalPromptCardProps {
  id: GlobalPromptId
  label: string
  description: string
  onEdit: (id: GlobalPromptId) => void
}

/**
 * One global prompt on the module page. Its text stays behind the prompt password,
 * so the card shows what the prompt is for and opens the editor on its tab.
 */
export const GlobalPromptCard: React.FC<GlobalPromptCardProps> = ({ id, label, description, onEdit }) => {
  const Icon = PROMPT_ICONS[id]
  const titleId = `global-prompt-${id}-title`

  return (
    <article
      aria-labelledby={titleId}
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-w-0"
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-bold text-on-surface leading-snug">
            {label}
          </h2>
          <p className="text-[13px] text-on-surface-variant leading-relaxed mt-1">{description}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 pt-4">
        <span className="text-[11px] font-semibold text-outline">{getGlobalPromptUsage(id)}</span>
        <button
          type="button"
          onClick={() => onEdit(id)}
          aria-label={`Edit ${label}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
        >
          <FilePenLine size={16} aria-hidden="true" />
          Edit Prompt
        </button>
      </div>
    </article>
  )
}
