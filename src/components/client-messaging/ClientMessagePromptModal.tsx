"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import {
  CLIENT_MESSAGE_PROMPT_ID,
  CLIENT_MESSAGE_PROMPT_TABS,
  CLIENT_MESSAGING_ENDPOINT,
} from "@/constants/clientMessaging"
import type { EditablePrompt } from "@/types/prompts"

const PROMPT_ENDPOINT = `${CLIENT_MESSAGING_ENDPOINT}/prompt`
const VARIABLES = [
  { name: "message_format", description: "the chosen client's message format" },
  { name: "sample_messages", description: "that client's sample messages" },
  { name: "update", description: "what you want to tell them this time" },
  { name: "channel", description: "where it is being sent, e.g. WhatsApp" },
  { name: "country", description: "the client's country" },
]

async function loadPrompt(signal: AbortSignal): Promise<Record<string, EditablePrompt>> {
  const { data } = await requestApi<EditablePrompt>(PROMPT_ENDPOINT, { signal })
  return { [CLIENT_MESSAGE_PROMPT_ID]: data }
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
    <p className="font-semibold text-on-surface-variant">
      This one prompt writes every client message, for every channel.
    </p>
    <ul className="space-y-0.5">
      {VARIABLES.map((variable) => (
        <li key={variable.name}>
          <code className="font-code text-on-surface-variant">{`{{${variable.name}}}`}</code> {variable.description}
        </li>
      ))}
    </ul>
    <p>
      Anything you leave out is added at the end. The app always keeps the message inside the channel&apos;s length, and
      never lets the client&apos;s name appear in it.
    </p>
  </div>
)

interface ClientMessagePromptModalProps {
  onClose: () => void
}

/**
 * Edits the module's one overall prompt: how a formal client message is written.
 */
export const ClientMessagePromptModal: React.FC<ClientMessagePromptModalProps> = ({ onClose }) => (
  <PromptTabsModal
    title="Update Client Message Prompt"
    description="This prompt decides how every client message is written. The client's own format and sample messages are placed inside it."
    tabs={CLIENT_MESSAGE_PROMPT_TABS}
    initialTab={CLIENT_MESSAGE_PROMPT_ID}
    loadPrompts={loadPrompt}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved client message prompt..."
    onClose={onClose}
  />
)
