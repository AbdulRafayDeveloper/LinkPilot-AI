import { loadPrompt, type PromptName } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { senderProfileEntry, toSenderProfileText } from "@/services/senderProfile"
import {
  ABOUT_ME_TAB_ID,
  OUTREACH_PROMPT_IDS,
  type OutreachPromptId,
  type OutreachTuneId,
} from "@/constants/outreachTunes"
import type { EditablePrompt } from "@/types/prompts"

export interface OutreachPrompt extends EditablePrompt {
  id: OutreachPromptId
}

interface OutreachPromptStoreConfig {
  // Setting key for one tune's prompt in this module
  settingKey: (tune: OutreachTuneId) => string
  // Default template for one tune's prompt in this module
  templateName: (tune: OutreachTuneId) => PromptName
}

/**
 * Prompt storage for a module built on the outreach tunes. Each tune has its own Setting
 * record and default template, so editing one tune's prompt never changes another's.
 * "About me" maps to the sender profile shared across modules.
 */
export function createOutreachPromptStore({ settingKey, templateName }: OutreachPromptStoreConfig) {
  const entryFor = (id: OutreachPromptId): PromptEntry =>
    id === ABOUT_ME_TAB_ID ? senderProfileEntry() : { key: settingKey(id), defaultPrompt: loadPrompt(templateName(id)) }

  return {
    async getPrompts(): Promise<OutreachPrompt[]> {
      const entries = OUTREACH_PROMPT_IDS.map((id) => ({ id, entry: entryFor(id) }))
      const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
      return entries.map(({ id, entry }, index) => ({ id, ...stored[index], defaultPrompt: entry.defaultPrompt }))
    },

    async savePrompt(id: OutreachPromptId, prompt: string): Promise<OutreachPrompt> {
      const entry = entryFor(id)
      const saved = await saveStoredPrompt(entry, prompt)
      return { id, ...saved, defaultPrompt: entry.defaultPrompt }
    },

    // Latest saved prompt for the tune plus the sender profile, in one query
    async getGenerationInputs(tune: OutreachTuneId): Promise<{ tunePrompt: string; senderProfile: string | null }> {
      const [tunePrompt, senderProfile] = await getStoredPrompts([entryFor(tune), senderProfileEntry()])
      return { tunePrompt: tunePrompt.prompt, senderProfile: toSenderProfileText(senderProfile) }
    },
  }
}
