"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { PromptEditorField } from "@/components/prompts/PromptEditorField"
import {
  PromptLoadFailed,
  PromptLoading,
  PromptModalFooter,
  type PromptFeedback,
} from "@/components/prompts/PromptModalParts"
import { requestApi } from "@/lib/apiClient"
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
    pasted comments (appended if omitted) · <code className={variableChip}>{"{{knowledge_base}}"}</code> matching Knowledge Base excerpts ·{" "}
    <code className={variableChip}>{"{{web_research}}"}</code> live web research (slower). Replies always answer a real
    comment and never invent facts.
  </p>
)

// Arrow-key navigation for a tab list: returns the tab to move to, or null for other keys
function nextTabIndex(key: string, index: number, count: number): number | null {
  const lastIndex = count - 1
  const targets: Record<string, number> = {
    ArrowRight: index === lastIndex ? 0 : index + 1,
    ArrowLeft: index === 0 ? lastIndex : index - 1,
    Home: 0,
    End: lastIndex,
  }
  return targets[key] ?? null
}

const tabClass = (isActive: boolean) =>
  `inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
    isActive ? "bg-white text-primary font-bold shadow-sm" : "text-on-surface-variant font-semibold hover:text-on-surface hover:bg-white/60"
  }`

const UnsavedDot = () => (
  <>
    <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" aria-hidden="true" />
    <span className="sr-only">(unsaved changes)</span>
  </>
)

/**
 * Edits the 14 independent reply prompts: choose the context, then the style, and the
 * editor loads that exact pair's prompt. Drafts are kept per pair while the modal is
 * open, and Save persists only the active pair.
 */
export const ReplyPromptsModal: React.FC<ReplyPromptsModalProps> = ({ initialContext, initialStyle, onClose }) => {
  const idPrefix = useId()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState<Record<PromptKey, ReplyPrompt> | null>(null)
  const [drafts, setDrafts] = useState<Partial<Record<PromptKey, string>>>({})
  const [activeContext, setActiveContext] = useState<ReplyContextId>(initialContext)
  const [activeStyle, setActiveStyle] = useState<ReplyStyleId>(initialStyle ?? REPLY_STYLES[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const contextTabRefs = useRef<Partial<Record<ReplyContextId, HTMLButtonElement | null>>>({})
  const styleTabRefs = useRef<Partial<Record<ReplyStyleId, HTMLButtonElement | null>>>({})

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

  const selectContext = (context: ReplyContextId, moveFocus = false) => {
    setActiveContext(context)
    setFeedback(null)
    if (moveFocus) contextTabRefs.current[context]?.focus()
  }

  const selectStyle = (style: ReplyStyleId, moveFocus = false) => {
    setActiveStyle(style)
    setFeedback(null)
    if (moveFocus) styleTabRefs.current[style]?.focus()
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
      footer={
        <PromptModalFooter
          feedback={feedback}
          hasUnsavedChanges={unsavedCount > 0}
          isSaving={isSaving}
          canSave={isDirty(activeKey) && activeDraft.trim().length > 0 && !isSaving}
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
        <div className="space-y-3">
          <div role="tablist" aria-label="Post context" className="grid grid-cols-2 gap-1 bg-surface-container-low p-1 rounded-xl">
            {REPLY_CONTEXTS.map((context, index) => {
              const isActive = context.id === activeContext
              return (
                <button
                  key={context.id}
                  ref={(element) => {
                    contextTabRefs.current[context.id] = element
                  }}
                  id={contextTabId(context.id)}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={contextPanelId}
                  tabIndex={isActive ? 0 : -1}
                  disabled={isSaving}
                  onClick={() => selectContext(context.id)}
                  onKeyDown={(event) => {
                    const target = nextTabIndex(event.key, index, REPLY_CONTEXTS.length)
                    if (target === null) return
                    event.preventDefault()
                    selectContext(REPLY_CONTEXTS[target].id, true)
                  }}
                  className={`${tabClass(isActive)} text-[13px] py-2`}
                >
                  <span className="truncate">{context.label}</span>
                  {isContextDirty(context.id) && <UnsavedDot />}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" id={contextPanelId} aria-labelledby={contextTabId(activeContext)} className="space-y-3">
            <div
              role="tablist"
              aria-label={`${getReplyContextLabel(activeContext)} reply styles`}
              className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-surface-container-low p-1 rounded-xl"
            >
              {REPLY_STYLES.map((style, index) => {
                const isActive = style.id === activeStyle
                return (
                  <button
                    key={style.id}
                    ref={(element) => {
                      styleTabRefs.current[style.id] = element
                    }}
                    id={styleTabId(style.id)}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={stylePanelId}
                    tabIndex={isActive ? 0 : -1}
                    disabled={isSaving}
                    onClick={() => selectStyle(style.id)}
                    onKeyDown={(event) => {
                      const target = nextTabIndex(event.key, index, REPLY_STYLES.length)
                      if (target === null) return
                      event.preventDefault()
                      selectStyle(REPLY_STYLES[target].id, true)
                    }}
                    className={tabClass(isActive)}
                  >
                    <span className="truncate">{style.label}</span>
                    {isDirty(promptKey(activeContext, style.id)) && <UnsavedDot />}
                  </button>
                )
              })}
            </div>

            <div role="tabpanel" id={stylePanelId} aria-labelledby={styleTabId(activeStyle)}>
              <PromptEditorField
                key={activeKey}
                value={activeDraft}
                onChange={(value) => {
                  setDrafts((current) => ({ ...current, [activeKey]: value }))
                  if (feedback?.type === "success") setFeedback(null)
                }}
                saved={saved[activeKey]}
                label={`${getReplyContextLabel(activeContext)} ${getReplyStyleLabel(activeStyle)} prompt`}
                disabled={isSaving}
                hint={<VariablesHint />}
                heightClassName="h-[34vh] min-h-[180px]"
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
