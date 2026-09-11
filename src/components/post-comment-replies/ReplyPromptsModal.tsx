"use client"

import React, { useEffect, useId, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { PromptAccessGate } from "@/components/prompts/PromptAccessGate"
import { PromptEditorField } from "@/components/prompts/PromptEditorField"
import { PromptTabStrip } from "@/components/prompts/PromptTabStrip"
import {
  PromptLoadFailed,
  PromptLoading,
  PromptModalFooter,
  type PromptFeedback,
} from "@/components/prompts/PromptModalParts"
import { requestApi } from "@/lib/apiClient"
import { useCloseAfterSave } from "@/hooks/useCloseAfterSave"
import {
  REPLY_CONTEXTS,
  REPLY_STYLES,
  getReplyContextLabel,
  getReplyStyleLabel,
  type ReplyContextId,
  type ReplyStyleId,
} from "@/constants/postCommentReplies"
import type { ReplyPrompt } from "@/types/postCommentReplies"

const PROMPTS_ENDPOINT = "/api/post-comment-replies/prompts"

type PromptKey = `${ReplyContextId}:${ReplyStyleId}`

const promptKey = (context: ReplyContextId, style: ReplyStyleId): PromptKey => `${context}:${style}`

interface ReplyPromptsModalProps {
  initialContext: ReplyContextId
  initialStyle: ReplyStyleId | null
  onClose: () => void
}

const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

const VariablesHint = () => (
  <p className="leading-relaxed">
    Variables: <code className={variableChip}>{"{{conversation}}"}</code> the post (pasted or from a screenshot) and the
    pasted comments (appended if omitted) · <code className={variableChip}>{"{{sender_profile}}"}</code> your About Me profile ·{" "}
    <code className={variableChip}>{"{{web_research}}"}</code> live web research (slower). Replies always answer a real
    comment and never invent facts.
  </p>
)

/**
 * Edits the 14 independent reply prompts: choose the context, then the style, and the
 * editor loads that exact pair's prompt. Drafts are kept per pair while the modal is
 * open, and Save persists only the active pair. It opens only after the prompt password
 * check (PromptAccessGate).
 */
export const ReplyPromptsModal: React.FC<ReplyPromptsModalProps> = (props) => (
  <PromptAccessGate onClose={props.onClose}>
    <ReplyPromptsEditor {...props} />
  </PromptAccessGate>
)

const ReplyPromptsEditor: React.FC<ReplyPromptsModalProps> = ({ initialContext, initialStyle, onClose }) => {
  const idPrefix = useId()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState<Record<PromptKey, ReplyPrompt> | null>(null)
  const [drafts, setDrafts] = useState<Partial<Record<PromptKey, string>>>({})
  const [activeContext, setActiveContext] = useState<ReplyContextId>(initialContext)
  const [activeStyle, setActiveStyle] = useState<ReplyStyleId>(initialStyle ?? REPLY_STYLES[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const { isClosing, closeAfterSave } = useCloseAfterSave(onClose)
  const isBusy = isSaving || isClosing

  const contextPanelId = `${idPrefix}-context-panel`
  const stylePanelId = `${idPrefix}-style-panel`
  const contextTabId = (context: ReplyContextId) => `${idPrefix}-context-${context}`
  const styleTabId = (style: ReplyStyleId) => `${idPrefix}-style-${style}`

  useEffect(() => {
    const controller = new AbortController()
    requestApi<ReplyPrompt[]>(PROMPTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setSaved(Object.fromEntries(data.map((entry) => [promptKey(entry.context, entry.style), entry])) as Record<PromptKey, ReplyPrompt>)
        setDrafts(Object.fromEntries(data.map((entry) => [promptKey(entry.context, entry.style), entry.prompt])))
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
  }, [loadAttempt])

  const activeKey = promptKey(activeContext, activeStyle)
  const activeDraft = drafts[activeKey] ?? ""
  const isDirty = (key: PromptKey) => saved !== null && drafts[key] !== saved[key].prompt
  const isContextDirty = (context: ReplyContextId) => REPLY_STYLES.some((style) => isDirty(promptKey(context, style.id)))
  const unsavedCount = saved ? (Object.keys(saved) as PromptKey[]).filter(isDirty).length : 0

  const selectContext = (context: ReplyContextId) => {
    setActiveContext(context)
    setFeedback(null)
  }

  const selectStyle = (style: ReplyStyleId) => {
    setActiveStyle(style)
    setFeedback(null)
  }

  const handleSave = async () => {
    const context = activeContext
    const style = activeStyle
    const key = promptKey(context, style)
    setIsSaving(true)
    setFeedback(null)
    try {
      const { data, message } = await requestApi<ReplyPrompt>(`${PROMPTS_ENDPOINT}/${context}/${style}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: drafts[key] ?? "" }),
      })
      setSaved((current) => (current ? { ...current, [key]: data } : current))
      setDrafts((current) => ({ ...current, [key]: data.prompt }))
      setFeedback({ type: "success", message: message || "Prompt saved." })
      closeAfterSave()
    } catch (error: unknown) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't save the prompt." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title="Update Reply Prompts"
      description="Each context and reply style has its own independent prompt, 14 in total. Saving one never changes the others, and future replies with that context and style use the saved version."
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="large"
      footer={
        <PromptModalFooter
          feedback={feedback}
          hasUnsavedChanges={unsavedCount > 0}
          isSaving={isSaving}
          canSave={isDirty(activeKey) && activeDraft.trim().length > 0 && !isBusy}
          onCancel={onClose}
          onSave={handleSave}
        />
      }
    >
      {isLoading ? (
        <PromptLoading text="Loading the saved reply prompts..." />
      ) : !saved ? (
        <PromptLoadFailed
          onRetry={() => {
            setIsLoading(true)
            setLoadAttempt((attempt) => attempt + 1)
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <PromptTabStrip
            tabs={REPLY_CONTEXTS}
            activeId={activeContext}
            onSelect={selectContext}
            isDirty={isContextDirty}
            ariaLabel="Post context"
            tabId={contextTabId}
            panelId={contextPanelId}
            disabled={isBusy}
          />

          <div
            role="tabpanel"
            id={contextPanelId}
            aria-labelledby={contextTabId(activeContext)}
            className="flex flex-col gap-3 flex-1 min-h-0"
          >
            <PromptTabStrip
              tabs={REPLY_STYLES}
              activeId={activeStyle}
              onSelect={selectStyle}
              isDirty={(style) => isDirty(promptKey(activeContext, style))}
              ariaLabel={`${getReplyContextLabel(activeContext)} reply styles`}
              tabId={styleTabId}
              panelId={stylePanelId}
              disabled={isBusy}
            />

            <div
              role="tabpanel"
              id={stylePanelId}
              aria-labelledby={styleTabId(activeStyle)}
              className="flex flex-col flex-1 min-h-0"
            >
              <PromptEditorField
                key={activeKey}
                value={activeDraft}
                onChange={(value) => {
                  setDrafts((current) => ({ ...current, [activeKey]: value }))
                  if (feedback?.type === "success") setFeedback(null)
                }}
                saved={saved[activeKey]}
                label={`${getReplyContextLabel(activeContext)} ${getReplyStyleLabel(activeStyle)} prompt`}
                disabled={isBusy}
                hint={<VariablesHint />}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
