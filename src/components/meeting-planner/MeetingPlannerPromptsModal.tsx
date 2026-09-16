"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import {
  MEETING_PLANNER_ENDPOINT,
  MEETING_PLANNER_PROMPT_TABS,
  type MeetingPlannerPromptId,
} from "@/constants/meetingPlanner"
import type { MeetingPlannerPrompt } from "@/services/meetingPlanner/prompts"

const PROMPTS_ENDPOINT = `${MEETING_PLANNER_ENDPOINT}/prompts`

async function loadPrompts(signal: AbortSignal): Promise<Record<MeetingPlannerPromptId, MeetingPlannerPrompt>> {
  const { data } = await requestApi<MeetingPlannerPrompt[]>(PROMPTS_ENDPOINT, { signal })
  return Object.fromEntries(data.map((entry) => [entry.id, entry])) as Record<MeetingPlannerPromptId, MeetingPlannerPrompt>
}

function savePrompt(id: MeetingPlannerPromptId, prompt: string) {
  return requestApi<MeetingPlannerPrompt>(`${PROMPTS_ENDPOINT}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = () => (
  <div className="space-y-1 leading-relaxed">
    <p className="font-semibold text-on-surface-variant">
      What the preparation reads, and the shape it comes back in.
    </p>
    <p>
      <code className="font-code text-on-surface-variant">{"{{profile_info}}"}</code>,{" "}
      <code className="font-code text-on-surface-variant">{"{{conversation_history}}"}</code> and{" "}
      <code className="font-code text-on-surface-variant">{"{{additional_info}}"}</code> are what you paste about the person,{" "}
      <code className="font-code text-on-surface-variant">{"{{sender_profile}}"}</code> is your own About Me and Rafay Profile
      Info, and <code className="font-code text-on-surface-variant">{"{{meeting_name}}"}</code>,{" "}
      <code className="font-code text-on-surface-variant">{"{{meeting_when}}"}</code> and{" "}
      <code className="font-code text-on-surface-variant">{"{{person_name}}"}</code> are the meeting itself. Anything you
      leave out is added at the end.
    </p>
    <p>
      The rules that keep it grounded (never inventing a background, never putting a claim in your mouth) are fixed and
      not edited here. Meetings already prepared keep what they have.
    </p>
  </div>
)

interface MeetingPlannerPromptsModalProps {
  onClose: () => void
}

/**
 * Edits the meeting preparation prompt: what it reads about the person and how the plan is shaped.
 */
export const MeetingPlannerPromptsModal: React.FC<MeetingPlannerPromptsModalProps> = ({ onClose }) => (
  <PromptTabsModal
    title="Update Meeting Preparation Prompt"
    description="How a meeting is prepared: the read of the person, the topics worth covering and the conversation plan."
    tabs={MEETING_PLANNER_PROMPT_TABS}
    initialTab="preparation"
    loadPrompts={loadPrompts}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved preparation prompt..."
    onClose={onClose}
  />
)
