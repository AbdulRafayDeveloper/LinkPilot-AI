import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { CONNECTION_NOTE_TONES, type ConnectionNoteToneId } from "@/constants/connectionNote"
import type { ConnectionNoteTonePrompt } from "@/types/connectionNote"

/**
 * Each tone has its own prompt record, so editing one tone's prompt can never change another's.
 */
const tonePromptName = (tone: ConnectionNoteToneId): PromptName => `connection-note-${tone}`

export async function getConnectionNotePrompts(): Promise<ConnectionNoteTonePrompt[]> {
  const stored = await getStoredPrompts(CONNECTION_NOTE_TONES.map((tone) => tonePromptName(tone.id)))
  return CONNECTION_NOTE_TONES.map((tone, index) => ({ tone: tone.id, ...stored[index] }))
}

export async function getActiveTonePrompt(tone: ConnectionNoteToneId): Promise<string> {
  const { prompt } = await getStoredPrompt(tonePromptName(tone))
  return prompt
}

export async function saveTonePrompt(tone: ConnectionNoteToneId, prompt: string): Promise<ConnectionNoteTonePrompt> {
  return { tone, ...(await saveStoredPrompt(tonePromptName(tone), prompt)) }
}
