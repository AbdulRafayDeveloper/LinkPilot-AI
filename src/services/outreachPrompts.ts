import { loadPrompt, type PromptName } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { senderProfileEntry, toSenderProfileText } from "@/services/senderProfile"
import { ABOUT_ME_TAB_ID } from "@/constants/outreachTunes"
import type { EditablePrompt } from "@/types/prompts"

export interface OutreachPrompt<Id extends string = string> extends EditablePrompt {
  id: Id
}

interface OutreachPromptStoreConfig<TuneId extends string> {
  // Every prompt the module edits, in tab order: its tunes plus About Me
  promptIds: readonly (TuneId | typeof ABOUT_ME_TAB_ID)[]
  // Setting key for one tune's prompt in this module
  settingKey: (tune: TuneId) => string
  // Default template for one tune's prompt in this module
  templateName: (tune: TuneId) => PromptName
}

/**
 * Prompt storage for an outreach module (First Message, InMail), each with its own tune
 * list. Each tune has its own Setting record and default template, so editing one tune's
 * prompt never changes another's. "About me" maps to the sender profile shared across modules.
 */
export function createOutreachPromptStore<TuneId extends string>({
  promptIds,
  settingKey,
  templateName,
}: OutreachPromptStoreConfig<TuneId>) {
  type PromptId = TuneId | typeof ABOUT_ME_TAB_ID
  // Any id other than About Me is one of this module's tunes
  const entryFor = (id: PromptId): PromptEntry =>
    id === ABOUT_ME_TAB_ID
      ? senderProfileEntry()
      : { key: settingKey(id as TuneId), defaultPrompt: loadPrompt(templateName(id as TuneId)) }

  return {
    async getPrompts(): Promise<OutreachPrompt<PromptId>[]> {
      const entries = promptIds.map((id) => ({ id, entry: entryFor(id) }))
      const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
      return entries.map(({ id, entry }, index) => ({ id, ...stored[index], defaultPrompt: entry.defaultPrompt }))
    },

    async savePrompt(id: PromptId, prompt: string): Promise<OutreachPrompt<PromptId>> {
      const entry = entryFor(id)
      const saved = await saveStoredPrompt(entry, prompt)
      return { id, ...saved, defaultPrompt: entry.defaultPrompt }
    },

    // Latest saved prompt for the tune plus the sender profile, in one query
    async getGenerationInputs(tune: TuneId): Promise<{ tunePrompt: string; senderProfile: string | null }> {
      const [tunePrompt, senderProfile] = await getStoredPrompts([entryFor(tune), senderProfileEntry()])
      return { tunePrompt: tunePrompt.prompt, senderProfile: toSenderProfileText(senderProfile) }
    },
  }
}
