import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { MEETING_PLANNER_PROMPT_TABS, type MeetingPlannerPromptId } from "@/constants/meetingPlanner"
import type { EditablePrompt } from "@/types/prompts"

/**
 * The preparation prompt is the user's own, so the read of the lead and the shape of the
 * conversation plan can be changed without touching code. The fixed rules that keep the model
 * honest live in the `meeting-prep-system` record, which is not editable.
 */
const promptName = (id: MeetingPlannerPromptId): PromptName => `meeting-prep-${id}`

export interface MeetingPlannerPrompt extends EditablePrompt {
  id: MeetingPlannerPromptId
}

export async function getMeetingPlannerPrompts(): Promise<MeetingPlannerPrompt[]> {
  const stored = await getStoredPrompts(MEETING_PLANNER_PROMPT_TABS.map((tab) => promptName(tab.id)))
  return MEETING_PLANNER_PROMPT_TABS.map((tab, index) => ({ id: tab.id, ...stored[index] }))
}

export async function getActivePreparationPrompt(): Promise<string> {
  const { prompt } = await getStoredPrompt(promptName("preparation"))
  return prompt
}

export async function saveMeetingPlannerPrompt(
  id: MeetingPlannerPromptId,
  prompt: string
): Promise<MeetingPlannerPrompt> {
  return { id, ...(await saveStoredPrompt(promptName(id), prompt)) }
}
