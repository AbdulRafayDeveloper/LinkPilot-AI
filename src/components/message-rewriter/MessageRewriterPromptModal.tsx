"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import {
  MESSAGE_REWRITER_ENDPOINT,
  MESSAGE_REWRITER_PROMPT_ID,
  MESSAGE_REWRITER_PROMPT_TABS,
} from "@/constants/messageRewriter"
import type { EditablePrompt } from "@/types/prompts"

const PROMPT_ENDPOINT = `${MESSAGE_REWRITER_ENDPOINT}/prompt`
const VARIABLES = [
  { name: "message", description: "the message you pasted or spoke, in whatever language it is in" },
  { name: "max_chars", description: "the longest the rewrite may be, worked out from your message" },
]

async function loadPrompt(signal: AbortSignal): Promise<Record<string, EditablePrompt>> {
  const { data } = await requestApi<EditablePrompt>(PROMPT_ENDPOINT, { signal })
  return { [MESSAGE_REWRITER_PROMPT_ID]: data }
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
    <p className="font-semibold text-on-surface-variant">This one prompt rewrites every message, in every language.</p>
    <ul className="space-y-0.5">
      {VARIABLES.map((variable) => (
        <li key={variable.name}>
          <code className="font-code text-on-surface-variant">{`{{${variable.name}}}`}</code> {variable.description}
        </li>
      ))}
    </ul>
    <p>
      Anything you leave out is added at the end. The app always keeps the rewrite in English, no longer than what you
      wrote, and runs it through your Humanization prompt afterwards.
    </p>
  </div>
)

interface MessageRewriterPromptModalProps {
  onClose: () => void
}

/**
 * Edits the module's one overall prompt: how a message becomes short, clear English.
 */
export const MessageRewriterPromptModal: React.FC<MessageRewriterPromptModalProps> = ({ onClose }) => (
  <PromptTabsModal
    title="Update Message Rewriter Prompt"
    description="This prompt decides how your message is shortened and turned into English. Your own message is placed inside it."
    tabs={MESSAGE_REWRITER_PROMPT_TABS}
    initialTab={MESSAGE_REWRITER_PROMPT_ID}
    loadPrompts={loadPrompt}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved message rewriter prompt..."
    onClose={onClose}
  />
)
