"use client"

import React, { useRef } from "react"

export interface PromptTab<Id extends string> {
  id: Id
  label: string
}

interface PromptTabStripProps<Id extends string> {
  tabs: readonly PromptTab<Id>[]
  activeId: Id
  onSelect: (id: Id) => void
  isDirty: (id: Id) => boolean
  ariaLabel: string
  tabId: (id: Id) => string
  panelId: string
  disabled?: boolean
}

/**
 * The prompt selector used by every Update Prompt modal (Connection Note's pattern): equal
 * tabs in a rounded strip, the active one white with a primary label, an unsaved-changes dot,
 * and arrow-key navigation. Tabs wrap onto more rows when the modal is narrow.
 */
export function PromptTabStrip<Id extends string>({
  tabs,
  activeId,
  onSelect,
  isDirty,
  ariaLabel,
  tabId,
  panelId,
  disabled = false,
}: PromptTabStripProps<Id>) {
  const tabRefs = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({})

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const lastIndex = tabs.length - 1
    const targetIndex: number | undefined = {
      ArrowRight: index === lastIndex ? 0 : index + 1,
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      Home: 0,
      End: lastIndex,
    }[event.key]
    if (targetIndex === undefined) return
    event.preventDefault()
    const target = tabs[targetIndex].id
    onSelect(target)
    tabRefs.current[target]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-1 bg-surface-container-low p-1 rounded-xl shrink-0"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[tab.id] = element
            }}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              isActive
                ? "bg-white text-primary font-bold shadow-sm"
                : "text-on-surface-variant font-semibold hover:text-on-surface hover:bg-white/60"
            }`}
          >
            <span className="truncate">{tab.label}</span>
            {isDirty(tab.id) && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" aria-hidden="true" />
                <span className="sr-only">(unsaved changes)</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
