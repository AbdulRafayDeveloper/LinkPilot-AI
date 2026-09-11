import { createOutreachPromptStore } from "@/services/outreachPrompts"
import { inmailPromptKey } from "@/constants/inmail"

const store = createOutreachPromptStore({
  settingKey: inmailPromptKey,
  templateName: (tune) => `inmail-${tune}`,
})

export const getInMailPrompts = store.getPrompts
export const saveInMailPrompt = store.savePrompt
export const getInMailGenerationInputs = store.getGenerationInputs
