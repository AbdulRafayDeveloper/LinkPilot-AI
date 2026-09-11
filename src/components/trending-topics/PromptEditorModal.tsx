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
import type { EditablePrompt } from "@/types/prompts"

const PROMPT_ENDPOINT = "/api/trending-topics/prompt"

interface PromptEditorModalProps {
  onClose: () => void
}

/**
 * Loads the exact prompt the search uses from the server (the single source of truth),
 * lets the user edit, copy, restore the default, and persist it.
 */
export const PromptEditorModal: React.FC<PromptEditorModalProps> = ({ onClose }) => {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState<EditablePrompt | null>(null)
  const [draft, setDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<EditablePrompt>(PROMPT_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setSaved(data)
        setDraft(data.prompt)
        setFeedback(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't load the prompt." })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [loadAttempt])

  useEffect(() => {
    if (saved) textareaRef.current?.focus()
  }, [saved])

  const handleSave = async () => {
    setIsSaving(true)
    setFeedback(null)
    try {
      const { data, message } = await requestApi<EditablePrompt>(PROMPT_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: draft }),
      })
      setSaved(data)
      setDraft(data.prompt)
      setFeedback({ type: "success", message: message || "Prompt saved." })
    } catch (error: unknown) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't save the prompt." })
    } finally {
      setIsSaving(false)
    }
  }

  const isDirty = saved !== null && draft !== saved.prompt

  return (
    <Modal
      title="Update Prompt"
      description="This is the exact prompt every Trending Topics search uses. Change the subject, audience, recency, ranking or post style here, and the next search uses the saved version."
      onClose={onClose}
      isCloseDisabled={isSaving}
      footer={
        <PromptModalFooter
          feedback={feedback}
          hasUnsavedChanges={isDirty}
          isSaving={isSaving}
          canSave={isDirty && draft.trim().length > 0 && !isSaving}
          onCancel={onClose}
          onSave={handleSave}
        />
      }
    >
      {isLoading ? (
        <PromptLoading />
      ) : !saved ? (
        <PromptLoadFailed
          onRetry={() => {
            setIsLoading(true)
            setLoadAttempt((attempt) => attempt + 1)
          }}
        />
      ) : (
        <PromptEditorField
          value={draft}
          onChange={(value) => {
            setDraft(value)
            if (feedback?.type === "success") setFeedback(null)
          }}
          saved={saved}
          label="Trending topics prompt"
          disabled={isSaving}
          textareaRef={textareaRef}
          hint="The app always keeps these fixed: at most 3 topics, verified sources and dates, and web content treated as untrusted data."
        />
      )}
    </Modal>
  )
}
