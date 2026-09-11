"use client"

import React from "react"
import type { DetectedComment } from "@/lib/linkedinComments"

interface DetectedCommentsProps {
  name: string
  comments: DetectedComment[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  disabled?: boolean
}

const optionClass = (isSelected: boolean) =>
  `flex items-start gap-2 min-w-0 cursor-pointer rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
    isSelected
      ? "bg-primary-container border-primary-container text-on-primary-container"
      : "bg-white border-outline-variant text-on-surface hover:bg-surface-container-low"
  }`

const RadioDot: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
  <span
    aria-hidden="true"
    className={`mt-0.5 w-3 h-3 shrink-0 rounded-full border-2 ${
      isSelected ? "border-on-primary-container bg-on-primary-container/40" : "border-outline"
    }`}
  />
)

/**
 * Lets the user pick which detected comment to answer. "Best match" leaves the choice to
 * the selected style's prompt. The list scrolls internally, so long threads never stretch the page.
 */
export const DetectedComments: React.FC<DetectedCommentsProps> = ({ name, comments, selectedKey, onSelect, disabled = false }) => {
  const isAuto = !comments.some((comment) => comment.key === selectedKey)

  return (
    <fieldset disabled={disabled} className="min-w-0 shrink-0">
      <legend className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">
        Reply to · {comments.length} {comments.length === 1 ? "comment" : "comments"} detected
      </legend>
      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
        <label className={optionClass(isAuto)}>
          <input type="radio" name={name} checked={isAuto} onChange={() => onSelect(null)} className="sr-only" />
          <RadioDot isSelected={isAuto} />
          <span className="min-w-0">
            <span className="font-semibold">Best match</span>
            <span className={isAuto ? "text-on-primary-container/80" : "text-outline"}> · let the style prompt choose</span>
          </span>
        </label>
        {comments.map((comment) => {
          const isSelected = comment.key === selectedKey
          return (
            <label key={comment.key} className={optionClass(isSelected)} title={comment.text}>
              <input
                type="radio"
                name={name}
                checked={isSelected}
                onChange={() => onSelect(comment.key)}
                className="sr-only"
              />
              <RadioDot isSelected={isSelected} />
              <span className="min-w-0 truncate">
                <span className="font-semibold">{comment.author ?? "Unnamed commenter"}</span>
                <span className={isSelected ? "text-on-primary-container/80" : "text-on-surface-variant"}>
                  {" "}
                  — “{comment.text.replace(/\s+/g, " ")}”
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
