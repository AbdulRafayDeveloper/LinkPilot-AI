"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { CLIENT_VOICES_ENDPOINT, CLIENT_VOICES_PROMPT_ID, CLIENT_VOICES_PROMPT_TABS } from "@/constants/clientVoices"
import type { EditablePrompt } from "@/types/prompts"

const PROMPT_ENDPOINT = `${CLIENT_VOICES_ENDPOINT}/prompt`
const VARIABLES = [
  { name: "transcripts", description: "every transcript in the batch, one block per voice" },
  { name: "voice_count", description: "how many voices were written out" },
]

async function loadPrompt(signal: AbortSignal): Promise<Record<string, EditablePrompt>> {
  const { data } = await requestApi<EditablePrompt>(PROMPT_ENDPOINT, { signal })
  return { [CLIENT_VOICES_PROMPT_ID]: data }
}

function savePrompt(_id: string, prompt: string) {
  return requestApi<EditablePrompt>(PROMPT_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = () => (
  <div className="space-y-1 leading-relaxed">
    <p className="font-semibold text-on-surface-variant">This prompt turns the transcripts into the task list.</p>
    <ul className="space-y-0.5">
      {VARIABLES.map((variable) => (
        <li key={variable.name}>
          <code className="font-code text-on-surface-variant">{`{{${variable.name}}}`}</code> {variable.description}
        </li>
      ))}
    </ul>
    <p>
      Anything you leave out is added at the end. The app always keeps the list to one set of tasks for the whole batch,
      and drops a task it cannot tie back to a voice in it.
    </p>
  </div>
)

interface ClientVoicesPromptModalProps {
  onClose: () => void
}

/**
 * Edits the module's one prompt: how the client's own words become a list of work.
 */
export const ClientVoicesPromptModal: React.FC<ClientVoicesPromptModalProps> = ({ onClose }) => (
  <PromptTabsModal
    title="Update Task Extraction Prompt"
    description="This prompt decides what counts as a task in the client's voice messages and how each one is written."
    tabs={CLIENT_VOICES_PROMPT_TABS}
    initialTab={CLIENT_VOICES_PROMPT_ID}
    loadPrompts={loadPrompt}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved task extraction prompt..."
    onClose={onClose}
  />
)
