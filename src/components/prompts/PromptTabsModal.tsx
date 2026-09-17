"use client"

import React, { useEffect, useId, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { PromptEditorField } from "./PromptEditorField"
import { PromptTabStrip, type PromptTab } from "./PromptTabStrip"
import { PromptLoadFailed, PromptLoading, PromptModalFooter, type PromptFeedback } from "./PromptModalParts"
import { saveEditedPrompts } from "./saveEditedPrompts"
import { useCloseAfterSave } from "@/hooks/useCloseAfterSave"
import type { EditablePrompt } from "@/types/prompts"

export type { PromptTab } from "./PromptTabStrip"

interface PromptTabsModalProps<Id extends string> {
  title: string
  description: string
  // One tab per independent prompt; with a single tab the selector is hidden
  tabs: readonly PromptTab<Id>[]
  initialTab: Id | null
  // Pass stable (module-level) functions; they own the endpoint calls
  loadPrompts: (signal: AbortSignal) => Promise<Record<Id, EditablePrompt>>
  savePrompt: (id: Id, prompt: string) => Promise<{ data: EditablePrompt; message?: string }>
  // Receives the active tab's current draft too, so a hint can react to unsaved edits
  renderHint?: (id: Id, draft: string) => React.ReactNode
  loadingText?: string
  onClose: () => void
}

/**
 * The Update Prompt modal every tool uses (Connection Note's pattern, in a large dialog):
 * a tab per independent prompt, the editor filling the rest of the dialog, and the shared
 * footer. Signing in is all it needs; prompts are shared by every account.
 */
export function PromptTabsModal<Id extends string>(props: PromptTabsModalProps<Id>) {
  return <PromptTabsEditor {...props} />
}

// Drafts are kept per tab while the editor is open; Save stores every tab that was edited
function PromptTabsEditor<Id extends string>({
  title,
  description,
  tabs,
  initialTab,
  loadPrompts,
  savePrompt,
  renderHint,
  loadingText = "Loading the saved prompts...",
  onClose,
}: PromptTabsModalProps<Id>) {
  const idPrefix = useId()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState<Record<Id, EditablePrompt> | null>(null)
  const [drafts, setDrafts] = useState<Partial<Record<Id, string>>>({})
  const [activeTab, setActiveTab] = useState<Id>(initialTab ?? tabs[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const { isClosing, closeAfterSave } = useCloseAfterSave(onClose)
  const isBusy = isSaving || isClosing

  const panelId = `${idPrefix}-panel`
  const tabId = (id: Id) => `${idPrefix}-tab-${id}`
  const hasSelector = tabs.length > 1

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
  const editedTabs = tabs.filter((tab) => isTabDirty(tab.id))
  const activeDraft = drafts[activeTab] ?? ""
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? activeTab

  const selectTab = (id: Id) => {
    setActiveTab(id)
    setFeedback(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setFeedback(null)
    const result = await saveEditedPrompts(
      editedTabs.map((tab) => ({ key: tab.id, label: tab.label, prompt: drafts[tab.id] ?? "" })),
      savePrompt,
    )
    setSaved((current) => {
      if (!current) return current
      const next = { ...current }
      for (const { key, data } of result.saved) next[key] = data
      return next
    })
    setDrafts((current) => {
      const next = { ...current }
      for (const { key, data } of result.saved) next[key] = data.prompt
      return next
    })
    setFeedback(result.feedback)
    setIsSaving(false)
    if (result.problemKey === null) closeAfterSave()
    else setActiveTab(result.problemKey)
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="large"
      footer={
        <PromptModalFooter
          feedback={feedback}
          unsavedCount={editedTabs.length}
          isSaving={isSaving}
          canSave={editedTabs.length > 0 && !isBusy}
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
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {hasSelector && (
            <PromptTabStrip
              tabs={tabs}
              activeId={activeTab}
              onSelect={selectTab}
              isDirty={isTabDirty}
              ariaLabel={title}
              tabId={tabId}
              panelId={panelId}
              disabled={isBusy}
            />
          )}

          <div
            role={hasSelector ? "tabpanel" : undefined}
            id={panelId}
            aria-labelledby={hasSelector ? tabId(activeTab) : undefined}
            className="flex flex-col flex-1 min-h-0"
          >
            <PromptEditorField
              key={activeTab}
              value={activeDraft}
              onChange={(value) => {
                setDrafts((current) => ({ ...current, [activeTab]: value }))
                if (feedback?.type === "success") setFeedback(null)
              }}
              saved={saved[activeTab]}
              label={`${activeLabel} prompt`}
              disabled={isBusy}
              hint={renderHint?.(activeTab, activeDraft)}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
