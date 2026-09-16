import type { PromptName } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { MEETING_PROMPT_TABS, type MeetingPromptId } from "@/constants/meetings"
import type { EditablePrompt } from "@/types/prompts"

export interface MeetingPrompt extends EditablePrompt {
  id: MeetingPromptId
}

/**
 * The module's two editable prompts: how one part of a transcript is read, and how the parts
 * become one meeting. The fixed rules (never invent anything, say what is unknown) live in the
 * meeting-system prompt, which is not editable.
 */
const promptName = (id: MeetingPromptId): PromptName => `meeting-${id}`

export async function getMeetingPrompts(): Promise<MeetingPrompt[]> {
  const stored = await getStoredPrompts(MEETING_PROMPT_TABS.map((tab) => promptName(tab.id)))
  return MEETING_PROMPT_TABS.map((tab, index) => ({ id: tab.id, ...stored[index] }))
}

export async function saveMeetingPrompt(id: MeetingPromptId, prompt: string): Promise<MeetingPrompt> {
  return { id, ...(await saveStoredPrompt(promptName(id), prompt)) }
}
