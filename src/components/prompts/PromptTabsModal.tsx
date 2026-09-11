"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { PromptEditorField } from "./PromptEditorField"
import { PromptLoadFailed, PromptLoading, PromptModalFooter, type PromptFeedback } from "./PromptModalParts"
import type { EditablePrompt } from "@/types/prompts"

export interface PromptTab<Id extends string> {
  id: Id
  label: string
}

interface PromptTabsModalProps<Id extends string> {
  title: string
  description: string
  tabs: readonly PromptTab<Id>[]
  initialTab: Id | null
  // Pass stable (module-level) functions; they own the endpoint calls
  loadPrompts: (signal: AbortSignal) => Promise<Record<Id, EditablePrompt>>
  savePrompt: (id: Id, prompt: string) => Promise<{ data: EditablePrompt; message?: string }>
  // Receives the active tab's current draft too, so a hint can react to unsaved edits
  renderHint?: (id: Id, draft: string) => React.ReactNode
  loadingText?: string
  // "vertical" puts the tabs in a left-hand list on md+ screens, for many or long tab labels
  orientation?: "horizontal" | "vertical"
  onClose: () => void
}

/**
 * Edits several independent prompts, one tab each. Drafts are kept per tab while the
 * modal is open, and Save persists only the active tab's prompt.
 */
export function PromptTabsModal<Id extends string>({
  title,
  description,
  tabs,
  initialTab,
  loadPrompts,
  savePrompt,
  renderHint,
  loadingText = "Loading the saved prompts...",
  orientation = "horizontal",
  onClose,
}: PromptTabsModalProps<Id>) {
  const isVertical = orientation === "vertical"
  const idPrefix = useId()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState<Record<Id, EditablePrompt> | null>(null)
  const [drafts, setDrafts] = useState<Partial<Record<Id, string>>>({})
  const [activeTab, setActiveTab] = useState<Id>(initialTab ?? tabs[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const tabRefs = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({})

  const panelId = `${idPrefix}-panel`
  const tabId = (id: Id) => `${idPrefix}-tab-${id}`

  useEffect(() => {
    const controller = new AbortController()
    loadPrompts(controller.signal)
      .then((prompts) => {
        setSaved(prompts)
        setDrafts(Object.fromEntries(tabs.map((tab) => [tab.id, prompts[tab.id].prompt])) as Record<Id, string>)
        setFeedback(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't load the prompts." })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [loadAttempt, loadPrompts, tabs])

  const isTabDirty = (id: Id) => saved !== null && drafts[id] !== saved[id].prompt
  const hasUnsavedChanges = tabs.some((tab) => isTabDirty(tab.id))
  const activeDraft = drafts[activeTab] ?? ""
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? activeTab

  const selectTab = (id: Id, moveFocus = false) => {
    setActiveTab(id)
    setFeedback(null)
    if (moveFocus) tabRefs.current[id]?.focus()
  }

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const lastIndex = tabs.length - 1
    const next = index === lastIndex ? 0 : index + 1
    const previous = index === 0 ? lastIndex : index - 1
    const targetIndex: number | undefined = {
      ArrowRight: next,
      ArrowLeft: previous,
      ...(isVertical ? { ArrowDown: next, ArrowUp: previous } : {}),
      Home: 0,
      End: lastIndex,
    }[event.key]
    if (targetIndex === undefined) return
    event.preventDefault()
    selectTab(tabs[targetIndex].id, true)
  }

  const handleSave = async () => {
    const id = activeTab
    setIsSaving(true)
    setFeedback(null)
    try {
      const { data, message } = await savePrompt(id, drafts[id] ?? "")
      setSaved((current) => (current ? { ...current, [id]: data } : current))
      setDrafts((current) => ({ ...current, [id]: data.prompt }))
      setFeedback({ type: "success", message: message || "Prompt saved." })
    } catch (error: unknown) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't save the prompt." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      isCloseDisabled={isSaving}
      footer={
        <PromptModalFooter
          feedback={feedback}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          canSave={isTabDirty(activeTab) && activeDraft.trim().length > 0 && !isSaving}
          onCancel={onClose}
          onSave={handleSave}
        />
      }
    >
      {isLoading ? (
        <PromptLoading text={loadingText} />
      ) : !saved ? (
        <PromptLoadFailed
          onRetry={() => {
            setIsLoading(true)
            setLoadAttempt((attempt) => attempt + 1)
          }}
        />
      ) : (
        <div className={isVertical ? "flex flex-col md:flex-row gap-3" : "space-y-3"}>
          <div
            role="tablist"
            aria-label={title}
            aria-orientation={isVertical ? "vertical" : "horizontal"}
            className={`flex flex-wrap gap-1 bg-surface-container-low p-1 rounded-xl ${
              isVertical ? "md:flex-col md:flex-nowrap md:w-52 md:shrink-0 md:self-start" : ""
            }`}
          >
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTab
              const isDirty = isTabDirty(tab.id)
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
                  disabled={isSaving}
                  onClick={() => selectTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    isVertical ? "justify-center md:justify-between md:flex-none md:text-left" : "justify-center"
                  } ${
                    isActive
                      ? "bg-white text-primary font-bold shadow-sm"
                      : "text-on-surface-variant font-semibold hover:text-on-surface hover:bg-white/60"
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  {isDirty && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" aria-hidden="true" />
                      <span className="sr-only">(unsaved changes)</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" id={panelId} aria-labelledby={tabId(activeTab)} className="min-w-0 flex-1">
            <PromptEditorField
              key={activeTab}
              value={activeDraft}
              onChange={(value) => {
                setDrafts((current) => ({ ...current, [activeTab]: value }))
                if (feedback?.type === "success") setFeedback(null)
              }}
              saved={saved[activeTab]}
              label={`${activeLabel} prompt`}
              disabled={isSaving}
              hint={renderHint?.(activeTab, activeDraft)}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
