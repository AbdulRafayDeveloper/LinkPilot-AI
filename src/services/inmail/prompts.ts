import { createOutreachPromptStore } from "@/services/outreachPrompts"
import { INMAIL_PROMPT_IDS, type InMailTuneId } from "@/constants/inmail"

const store = createOutreachPromptStore<InMailTuneId>({
  promptIds: INMAIL_PROMPT_IDS,
  templateName: (tune) => `inmail-${tune}`,
})

export const getInMailPrompts = store.getPrompts
export const saveInMailPrompt = store.savePrompt
export const getInMailGenerationInputs = store.getGenerationInputs
