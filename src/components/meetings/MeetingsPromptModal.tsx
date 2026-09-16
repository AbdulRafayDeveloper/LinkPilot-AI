"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { MEETINGS_ENDPOINT, MEETING_PROMPT_TABS, type MeetingPromptId } from "@/constants/meetings"
import type { EditablePrompt } from "@/types/prompts"

const PROMPTS_ENDPOINT = `${MEETINGS_ENDPOINT}/prompts`
const TABS = MEETING_PROMPT_TABS.map((tab) => ({ id: tab.id, label: tab.label }))

interface MeetingPrompt extends EditablePrompt {
  id: MeetingPromptId
}

async function loadMeetingPrompts(signal: AbortSignal): Promise<Record<MeetingPromptId, MeetingPrompt>> {
  const { data } = await requestApi<MeetingPrompt[]>(PROMPTS_ENDPOINT, { signal })
  return Object.fromEntries(data.map((entry) => [entry.id, entry])) as Record<MeetingPromptId, MeetingPrompt>
}

function saveMeetingPrompt(id: MeetingPromptId, prompt: string) {
  return requestApi<MeetingPrompt>(`${PROMPTS_ENDPOINT}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = (id: MeetingPromptId) => (
  <div className="space-y-1 leading-relaxed">
    {id === "chunk" ? (
      <>
        <p className="font-semibold text-on-surface-variant">This runs once per part of a transcript.</p>
        <p>
          <code className="font-code text-on-surface-variant">{"{{transcript_part}}"}</code> is the part being read,{" "}
          <code className="font-code text-on-surface-variant">{"{{previous_context}}"}</code> the tail of the part before it, and{" "}
          <code className="font-code text-on-surface-variant">{"{{my_name}}"}</code> your name.
        </p>
      </>
    ) : (
      <>
        <p className="font-semibold text-on-surface-variant">This runs once, after every part has been read.</p>
        <p>
          <code className="font-code text-on-surface-variant">{"{{meeting_notes}}"}</code> is everything the parts gave up, already merged.
          It writes the title, the purpose, the topics and the minutes; the participants, decisions and tasks are merged by the app, so no
          fact can be summarised away.
        </p>
      </>
    )}
    <p>The fixed rules (never invent anything, mark what is only inferred, say what is unknown) are separate and always apply.</p>
  </div>
)

interface MeetingsPromptModalProps {
  initialTab: MeetingPromptId | null
  onClose: () => void
}

/**
 * Edits the two prompts the meeting analysis runs on, in the app's usual prompt editor.
 */
export const MeetingsPromptModal: React.FC<MeetingsPromptModalProps> = ({ initialTab, onClose }) => (
  <PromptTabsModal
    title="Update Meeting Analysis Prompts"
    description="One prompt reads a part of a transcript, the other turns every part into the finished meeting. Saving one never changes the other."
    tabs={TABS}
    initialTab={initialTab}
    loadPrompts={loadMeetingPrompts}
    savePrompt={saveMeetingPrompt}
    renderHint={renderHint}
    loadingText="Loading the saved meeting prompts..."
    onClose={onClose}
  />
)
