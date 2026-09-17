"use client"

import React, { useEffect, useId, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { PromptEditorField } from "@/components/prompts/PromptEditorField"
import { PromptTabStrip } from "@/components/prompts/PromptTabStrip"
import {
  PromptLoadFailed,
  PromptLoading,
  PromptModalFooter,
  type PromptFeedback,
} from "@/components/prompts/PromptModalParts"
import { saveEditedPrompts } from "@/components/prompts/saveEditedPrompts"
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

// Every context + style pair in tab order, so Save goes through the edited ones in the order they appear
const PROMPT_PAIRS = REPLY_CONTEXTS.flatMap((context) =>
  REPLY_STYLES.map((style) => ({
    key: promptKey(context.id, style.id),
    context: context.id,
    style: style.id,
    label: `${context.label} · ${style.label}`,
  })),
)

function savePairPrompt(key: PromptKey, prompt: string) {
  const [context, style] = key.split(":")
  return requestApi<ReplyPrompt>(`${PROMPTS_ENDPOINT}/${context}/${style}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

interface ReplyPromptsModalProps {
  initialContext: ReplyContextId
  initialStyle: ReplyStyleId | null
  onClose: () => void
}

const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

const VariablesHint = () => (
  <p className="leading-relaxed">
    Variables: <code className={variableChip}>{"{{conversation}}"}</code> the post and the whole comment thread ·{" "}
    <code className={variableChip}>{"{{latest_comment}}"}</code> or <code className={variableChip}>{"{{comment}}"}</code>{" "}
    the comment being answered (the latest one from someone other than you) ·{" "}
    <code className={variableChip}>{"{{post_content}}"}</code> the original post ·{" "}
    <code className={variableChip}>{"{{sender_profile}}"}</code> your profile (About Me + Rafay Profile Info) ·{" "}
    <code className={variableChip}>{"{{web_research}}"}</code> live web research (slower). Anything you leave out is added
    at the end. Replies always answer a real comment and never invent facts or numbers.
  </p>
)

/**
 * Edits the independent reply prompts, one per context + style pair: choose the context, then the style, and the
 * editor loads that exact pair's prompt. Drafts are kept per pair while the modal is
 * open, and Save stores every pair that was edited.
 */
export const ReplyPromptsModal: React.FC<ReplyPromptsModalProps> = (props) => <ReplyPromptsEditor {...props} />

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
  const editedPairs = PROMPT_PAIRS.filter((pair) => isDirty(pair.key))

  const selectContext = (context: ReplyContextId) => {
    setActiveContext(context)
    setFeedback(null)
  }

  const selectStyle = (style: ReplyStyleId) => {
    setActiveStyle(style)
    setFeedback(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setFeedback(null)
    const result = await saveEditedPrompts(
      editedPairs.map((pair) => ({ key: pair.key, label: pair.label, prompt: drafts[pair.key] ?? "" })),
      savePairPrompt,
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
    const problem = PROMPT_PAIRS.find((pair) => pair.key === result.problemKey)
    if (problem) {
      setActiveContext(problem.context)
      setActiveStyle(problem.style)
    } else {
      closeAfterSave()
    }
  }

  return (
    <Modal
      title="Update Reply Prompts"
      description={`Each context and reply style has its own independent prompt, ${REPLY_CONTEXTS.length * REPLY_STYLES.length} in total. Saving one never changes the others, and future replies with that context and style use the saved version.`}
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="large"
      footer={
        <PromptModalFooter
          feedback={feedback}
          unsavedCount={editedPairs.length}
          isSaving={isSaving}
          canSave={editedPairs.length > 0 && !isBusy}
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
