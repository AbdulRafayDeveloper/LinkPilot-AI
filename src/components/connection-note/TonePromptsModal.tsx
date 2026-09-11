"use client"

import React, { useEffect, useRef, useState } from "react"
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
  CONNECTION_NOTE_MAX_CHARS,
  CONNECTION_NOTE_TONES,
  type ConnectionNoteToneId,
} from "@/constants/connectionNote"
import type { ConnectionNoteTonePrompt } from "@/types/connectionNote"

const PROMPTS_ENDPOINT = "/api/connection-notes/prompts"
const PANEL_ID = "connection-note-tone-panel"

type ToneMap<T> = Record<ConnectionNoteToneId, T>

interface TonePromptsModalProps {
  initialTone: ConnectionNoteToneId | null
  onClose: () => void
}

const tabId = (tone: ConnectionNoteToneId) => `connection-note-tone-tab-${tone}`

const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

const VariablesHint = () => (
  <p className="leading-relaxed">
    Variables: <code className={variableChip}>{"{{profile_data}}"}</code> inserts the pasted profile (it&apos;s
    added at the end if you leave it out) · <code className={variableChip}>{"{{tone}}"}</code> inserts the tone
    name. The app always keeps notes within LinkedIn&apos;s {CONNECTION_NOTE_MAX_CHARS}-character limit and treats
    the profile as untrusted text.
  </p>
)

/**
 * Edits the four independent tone prompts. Drafts are kept per tone while the modal
 * is open, and Save persists only the active tone's prompt.
 */
export const TonePromptsModal: React.FC<TonePromptsModalProps> = ({ initialTone, onClose }) => {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState<ToneMap<ConnectionNoteTonePrompt> | null>(null)
  const [drafts, setDrafts] = useState<Partial<ToneMap<string>>>({})
  const [activeTone, setActiveTone] = useState<ConnectionNoteToneId>(initialTone ?? CONNECTION_NOTE_TONES[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const tabRefs = useRef<Partial<ToneMap<HTMLButtonElement | null>>>({})

  useEffect(() => {
    const controller = new AbortController()
    requestApi<ConnectionNoteTonePrompt[]>(PROMPTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        const byTone = Object.fromEntries(data.map((entry) => [entry.tone, entry])) as ToneMap<ConnectionNoteTonePrompt>
        setSaved(byTone)
        setDrafts(Object.fromEntries(data.map((entry) => [entry.tone, entry.prompt])))
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

  const isToneDirty = (tone: ConnectionNoteToneId) => saved !== null && drafts[tone] !== saved[tone].prompt
  const hasUnsavedChanges = CONNECTION_NOTE_TONES.some((tone) => isToneDirty(tone.id))
  const activeDraft = drafts[activeTone] ?? ""
  const activeLabel = CONNECTION_NOTE_TONES.find((tone) => tone.id === activeTone)?.label ?? activeTone

  const selectTone = (tone: ConnectionNoteToneId, moveFocus = false) => {
    setActiveTone(tone)
    setFeedback(null)
    if (moveFocus) tabRefs.current[tone]?.focus()
  }

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const lastIndex = CONNECTION_NOTE_TONES.length - 1
    const targetIndex = {
      ArrowRight: index === lastIndex ? 0 : index + 1,
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      Home: 0,
      End: lastIndex,
    }[event.key]
    if (targetIndex === undefined) return
    event.preventDefault()
    selectTone(CONNECTION_NOTE_TONES[targetIndex].id, true)
  }

  const handleSave = async () => {
    const tone = activeTone
    setIsSaving(true)
    setFeedback(null)
    try {
      const { data, message } = await requestApi<ConnectionNoteTonePrompt>(`${PROMPTS_ENDPOINT}/${tone}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: drafts[tone] ?? "" }),
      })
      setSaved((current) => (current ? { ...current, [tone]: data } : current))
      setDrafts((current) => ({ ...current, [tone]: data.prompt }))
      setFeedback({ type: "success", message: message || "Prompt saved." })
    } catch (error: unknown) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't save the prompt." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title="Update Connection Note Prompts"
      description="Each tone has its own independent prompt. Saving one tone never changes the others, and future notes in that tone use the saved version."
      onClose={onClose}
      isCloseDisabled={isSaving}
      footer={
        <PromptModalFooter
          feedback={feedback}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          canSave={isToneDirty(activeTone) && activeDraft.trim().length > 0 && !isSaving}
          onCancel={onClose}
          onSave={handleSave}
        />
      }
    >
      {isLoading ? (
        <PromptLoading text="Loading the saved tone prompts..." />
      ) : !saved ? (
        <PromptLoadFailed
          onRetry={() => {
            setIsLoading(true)
            setLoadAttempt((attempt) => attempt + 1)
          }}
        />
      ) : (
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Tone prompts"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-surface-container-low p-1 rounded-xl"
          >
            {CONNECTION_NOTE_TONES.map((tone, index) => {
              const isActive = tone.id === activeTone
              const isDirty = isToneDirty(tone.id)
              return (
                <button
                  key={tone.id}
                  ref={(element) => {
                    tabRefs.current[tone.id] = element
                  }}
                  id={tabId(tone.id)}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={PANEL_ID}
                  tabIndex={isActive ? 0 : -1}
                  disabled={isSaving}
                  onClick={() => selectTone(tone.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    isActive
                      ? "bg-white text-primary font-bold shadow-sm"
                      : "text-on-surface-variant font-semibold hover:text-on-surface hover:bg-white/60"
                  }`}
                >
                  <span className="truncate">{tone.label}</span>
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

          <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(activeTone)}>
            <PromptEditorField
              key={activeTone}
              value={activeDraft}
              onChange={(value) => {
                setDrafts((current) => ({ ...current, [activeTone]: value }))
                if (feedback?.type === "success") setFeedback(null)
              }}
              saved={saved[activeTone]}
              label={`${activeLabel} tone prompt`}
              disabled={isSaving}
              hint={<VariablesHint />}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
