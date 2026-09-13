import { createOutreachPromptStore } from "@/services/outreachPrompts"
import { FIRST_MESSAGE_PROMPT_IDS, firstMessagePromptKey, type FirstMessageTuneId } from "@/constants/firstMessage"

const store = createOutreachPromptStore<FirstMessageTuneId>({
  promptIds: FIRST_MESSAGE_PROMPT_IDS,
  settingKey: firstMessagePromptKey,
  templateName: (tune) => `first-message-${tune}`,
})

export const getFirstMessagePrompts = store.getPrompts
export const saveFirstMessagePrompt = store.savePrompt
export const getGenerationInputs = store.getGenerationInputs
