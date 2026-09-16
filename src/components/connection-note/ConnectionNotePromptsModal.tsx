"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import {
  CONNECTION_NOTE_MAX_CHARS,
  CONNECTION_NOTE_TONES,
  type ConnectionNoteToneId,
} from "@/constants/connectionNote"
import type { ConnectionNoteTonePrompt } from "@/types/connectionNote"
import type { EditablePrompt } from "@/types/prompts"

const PROMPTS_ENDPOINT = "/api/connection-notes/prompts"
const TABS = CONNECTION_NOTE_TONES.map(({ id, label }) => ({ id, label }))
const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

async function loadTonePrompts(signal: AbortSignal): Promise<Record<ConnectionNoteToneId, EditablePrompt>> {
  const { data } = await requestApi<ConnectionNoteTonePrompt[]>(PROMPTS_ENDPOINT, { signal })
  const byTone = {} as Record<ConnectionNoteToneId, EditablePrompt>
  for (const prompt of data) byTone[prompt.tone] = prompt
  return byTone
}

function saveTonePrompt(tone: ConnectionNoteToneId, prompt: string) {
  return requestApi<EditablePrompt>(`${PROMPTS_ENDPOINT}/${tone}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = () => (
  <p className="leading-relaxed">
    Variables: <code className={variableChip}>{"{{profile_data}}"}</code> inserts the pasted profile (it&apos;s added at
    the end if you leave it out) · <code className={variableChip}>{"{{sender_profile}}"}</code> inserts your own profile
    (About Me + Rafay Profile Info), only in prompts that use it ·{" "}
    <code className={variableChip}>{"{{company_name}}"}</code> the company you type in (Recently Funded and Hiring
    Startup only) · <code className={variableChip}>{"{{tone}}"}</code>{" "}
    inserts the tone name. The app
    always keeps notes within LinkedIn&apos;s {CONNECTION_NOTE_MAX_CHARS}-character limit and treats the profile as
    untrusted text.
  </p>
)

interface ConnectionNotePromptsModalProps {
  initialTone: ConnectionNoteToneId | null
  onClose: () => void
}

/**
 * Edits the independent tone prompts, one per tone. Saving one tone never changes the others.
 */
export const ConnectionNotePromptsModal: React.FC<ConnectionNotePromptsModalProps> = ({ initialTone, onClose }) => (
  <PromptTabsModal
    title="Update Connection Note Prompts"
    description="Each tone has its own independent prompt. Saving one tone never changes the others, and future notes in that tone use the saved version."
    tabs={TABS}
    initialTab={initialTone}
    loadPrompts={loadTonePrompts}
    savePrompt={saveTonePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved tone prompts..."
    onClose={onClose}
  />
)
