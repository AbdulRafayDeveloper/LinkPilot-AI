import { createOutreachPromptStore } from "@/services/outreachPrompts"
import { firstMessagePromptKey } from "@/constants/firstMessage"

const store = createOutreachPromptStore({
  settingKey: firstMessagePromptKey,
  templateName: (tune) => `first-message-${tune}`,
})

export const getFirstMessagePrompts = store.getPrompts
export const saveFirstMessagePrompt = store.savePrompt
export const getGenerationInputs = store.getGenerationInputs
