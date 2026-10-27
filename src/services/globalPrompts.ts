import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { getProfileInfoPrompt, saveProfileInfo } from "@/services/profileInfo"
import { GLOBAL_PROMPTS, PROFILE_INFO_ID, type GlobalPromptId } from "@/constants/globalPrompts"
import type { GlobalPrompt } from "@/types/globalPrompts"

/**
 * The global prompts, each kept on its own so editing one can never change another. Humanization is
 * one prompt record every tool's output passes through (services/humanizer.ts), shared by every
 * account and changed by an admin. **Profile Info is not a shared prompt**: it is each person's own,
 * kept on their account (services/profileInfo.ts), so it is read and saved for the account asking.
 */
type SharedPromptId = Exclude<GlobalPromptId, typeof PROFILE_INFO_ID>

const globalPromptName = (id: SharedPromptId): PromptName => `global-${id}`

/** The latest text of the prompts named, in the order given; Profile Info is the account's own. */
export async function getGlobalPrompts(
  accountId: string,
  ids: readonly GlobalPromptId[] = GLOBAL_PROMPTS.map((prompt) => prompt.id)
): Promise<GlobalPrompt[]> {
  return Promise.all(
    ids.map(async (id) =>
      id === PROFILE_INFO_ID ? { id, ...(await getProfileInfoPrompt(accountId)) } : { id, ...(await getStoredPrompts([globalPromptName(id)]))[0] }
    )
  )
}

/** The text a shared global prompt has now, for the tools. */
export async function getActiveGlobalPrompt(id: SharedPromptId): Promise<string> {
  const { prompt } = await getStoredPrompt(globalPromptName(id))
  return prompt
}

export async function saveGlobalPrompt(accountId: string, id: GlobalPromptId, prompt: string): Promise<GlobalPrompt> {
  if (id === PROFILE_INFO_ID) return { id, ...(await saveProfileInfo(accountId, prompt)) }
  return { id, ...(await saveStoredPrompt(globalPromptName(id), prompt)) }
}
