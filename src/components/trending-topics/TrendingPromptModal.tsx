"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { EditablePrompt } from "@/types/prompts"

const PROMPT_ENDPOINT = "/api/trending-topics/prompt"
const PROMPT_ID = "trending-topics"
const TABS = [{ id: PROMPT_ID, label: "Trending Topics" }] as const

type TrendingPromptId = typeof PROMPT_ID

async function loadPrompt(signal: AbortSignal): Promise<Record<TrendingPromptId, EditablePrompt>> {
  const { data } = await requestApi<EditablePrompt>(PROMPT_ENDPOINT, { signal })
  return { [PROMPT_ID]: data }
}

function savePrompt(_id: TrendingPromptId, prompt: string) {
  return requestApi<EditablePrompt>(PROMPT_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = () =>
  `The app always keeps these fixed: at most ${TRENDING_TOPIC_COUNT} topics, verified sources and dates, posts assembled as hook, body, source link and hashtags, and web content treated as untrusted data.`

/**
 * Edits the single prompt every Trending Topics search uses, in the shared Update Prompt modal.
 */
export const TrendingPromptModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <PromptTabsModal
    title="Update Prompt"
    description="This is the exact prompt every Trending Topics search uses. Change the subject, audience, recency, ranking or post style here, and the next search uses the saved version."
    tabs={TABS}
    initialTab={PROMPT_ID}
    loadPrompts={loadPrompt}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the active prompt..."
    onClose={onClose}
  />
)
