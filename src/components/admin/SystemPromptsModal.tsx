"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { ADMIN_PROMPTS_ENDPOINT, ADMIN_PROMPT_MESSAGES, promptLabel } from "@/constants/adminPrompts"
import type { AdminPrompt } from "@/services/admin/prompts"
import type { EditablePrompt } from "@/types/prompts"

/**
 * One module's system prompts in the shared tabbed editor, one tab a prompt: everything that module
 * sends the AI besides the tones its users choose between. Admin only, like the routes behind it.
 * The tabs are what is stored for the module, so a prompt added to the collection appears here with
 * no change to this file.
 */

interface SystemPromptsModalProps {
  // The module's name, as the sidebar has it
  title: string
  // The `tool` its prompts are stored under, and the prefixes their keys start with
  tool: string
  onClose: () => void
}

const loadSystemPrompts = (tool: string, signal?: AbortSignal) =>
  requestApi<AdminPrompt[]>(`${ADMIN_PROMPTS_ENDPOINT}?tool=${encodeURIComponent(tool)}`, { signal }).then(({ data }) => data)

// A module's keys start with its own name ("connection-note-system"), or with a shorter one for the
// modules whose prompts were named before the module was ("inmail-system", "follow-up-system")
const prefixesOf = (tool: string) => [tool, tool.replace(/-message$/, ""), tool.replace(/s$/, ""), tool.replace(/-replies$/, "-reply")]

export const SystemPromptsModal: React.FC<SystemPromptsModalProps> = ({ title, tool, onClose }) => {
  const [prompts, setPrompts] = useState<AdminPrompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadSystemPrompts(tool, controller.signal)
      .then(setPrompts)
      .catch((problem: unknown) => {
        if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : ADMIN_PROMPT_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [tool])

  if (!prompts || prompts.length === 0) {
    return (
      <Modal title={ADMIN_PROMPT_MESSAGES.systemTitle(title)} description={ADMIN_PROMPT_MESSAGES.systemDescription} onClose={onClose}>
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[13px] text-error">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : prompts ? (
          <p className="text-[13px] text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.noneStored}</p>
        ) : (
          <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
            <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
            Loading the prompts...
          </p>
        )}
      </Modal>
    )
  }

  const tabs = prompts.map((prompt) => ({ id: prompt.key, label: promptLabel(prompt.key, prefixesOf(tool)) }))

  return (
    <PromptTabsModal<string>
      title={ADMIN_PROMPT_MESSAGES.systemTitle(title)}
      description={ADMIN_PROMPT_MESSAGES.systemDescription}
      tabs={tabs}
      initialTab={tabs[0].id}
      // Read again when the editor opens, so it always starts from what is saved now
      loadPrompts={async (signal) => {
        const fresh = await loadSystemPrompts(tool, signal)
        return Object.fromEntries(fresh.map((prompt) => [prompt.key, prompt])) as Record<string, EditablePrompt>
      }}
      savePrompt={(key, prompt) =>
        requestApi<AdminPrompt>(`${ADMIN_PROMPTS_ENDPOINT}/${encodeURIComponent(key)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        })
      }
      renderHint={(key) => <span className="font-code text-[11px] text-outline">{key}</span>}
      onClose={onClose}
    />
  )
}
