import type { PromptName } from "@/services/prompts"
import { getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { SENDER_PROFILE_PROMPT, getFullSenderProfile, toSenderProfileText } from "@/services/senderProfile"
import { ABOUT_ME_TAB_ID } from "@/constants/outreachTunes"
import type { EditablePrompt } from "@/types/prompts"

// A tone that places this variable writes about the user, so it gets their full background
const SENDER_PROFILE_VARIABLE = "sender_profile"

export interface OutreachPrompt<Id extends string = string> extends EditablePrompt {
  id: Id
}

interface OutreachPromptStoreConfig<TuneId extends string> {
  // Every prompt the module edits, in tab order: its tunes plus About Me
  promptIds: readonly (TuneId | typeof ABOUT_ME_TAB_ID)[]
  // Prompt record for one tune's prompt in this module
  templateName: (tune: TuneId) => PromptName
}

/**
 * Prompt storage for an outreach module (First Message, InMail), each with its own tune
 * list. Each tune has its own prompt record, so editing one tune's prompt never changes
 * another's. "About me" maps to the sender profile shared across modules.
 */
export function createOutreachPromptStore<TuneId extends string>({
  promptIds,
  templateName,
}: OutreachPromptStoreConfig<TuneId>) {
  type PromptId = TuneId | typeof ABOUT_ME_TAB_ID
  // Any id other than About Me is one of this module's tunes
  const nameFor = (id: PromptId): PromptName => (id === ABOUT_ME_TAB_ID ? SENDER_PROFILE_PROMPT : templateName(id as TuneId))

  return {
    async getPrompts(): Promise<OutreachPrompt<PromptId>[]> {
      const stored = await getStoredPrompts(promptIds.map(nameFor))
      return promptIds.map((id, index) => ({ id, ...stored[index] }))
    },

    async savePrompt(id: PromptId, prompt: string): Promise<OutreachPrompt<PromptId>> {
      return { id, ...(await saveStoredPrompt(nameFor(id), prompt)) }
    },

    /**
     * Latest saved prompt for the tune plus the sender profile, in one query. A tune that
     * places {{sender_profile}} gets the user's full background (About Me plus Rafay Profile
     * Info), the same rule Connection Note follows; every other tune gets About Me only.
     */
    async getGenerationInputs(tune: TuneId): Promise<{ tunePrompt: string; senderProfile: string | null }> {
      const [tunePrompt, senderProfile] = await getStoredPrompts([nameFor(tune), SENDER_PROFILE_PROMPT])
      const usesFullProfile = tunePrompt.prompt.includes(`{{${SENDER_PROFILE_VARIABLE}}}`)
      return {
        tunePrompt: tunePrompt.prompt,
        senderProfile: usesFullProfile ? await getFullSenderProfile() : toSenderProfileText(senderProfile),
      }
    },
  }
}
