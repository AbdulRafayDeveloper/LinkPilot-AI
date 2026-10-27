import { isValidObjectId } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { UserModel } from "@/models/User"
import type { EditablePrompt } from "@/types/prompts"

/**
 * Profile Info: each person's own background, projects and numbers, kept on their own account and
 * written on My AI Profile. It used to be one prompt shared by every account (`global-rafay-profile`),
 * which an admin could change for everyone; it is the person's own now, so a tool writing as someone
 * only ever quotes that person's facts, and no admin page offers it.
 *
 * Read by the account id the AI request runs as (`currentAiRequest().ownerId`, which is `viewer.id`).
 */

const NOT_FOUND = "That account no longer exists."

/** The person's Profile Info, or null while they have written none. */
export async function getProfileInfo(accountId: string | null): Promise<string | null> {
  if (!accountId || !isValidObjectId(accountId)) return null
  await connectDatabase()
  const account = await UserModel.findById(accountId, { profileInfo: 1 }).lean()
  return account?.profileInfo?.trim() || null
}

/** The person's Profile Info in the shape the prompt editor reads: there is no default to go back to. */
export async function getProfileInfoPrompt(accountId: string): Promise<EditablePrompt> {
  await connectDatabase()
  const account = await UserModel.findById(accountId, { profileInfo: 1, profileInfoUpdatedAt: 1 }).lean()
  if (!account) throw new UserFacingError(NOT_FOUND)
  const text = account.profileInfo ?? ""
  return { prompt: text, defaultPrompt: "", isCustom: text.trim().length > 0, updatedAt: account.profileInfoUpdatedAt?.toISOString() ?? null }
}

/** Saves the person's own Profile Info; nobody else's is ever touched. */
export async function saveProfileInfo(accountId: string, text: string): Promise<EditablePrompt> {
  await connectDatabase()
  const saved = await UserModel.findByIdAndUpdate(
    accountId,
    { profileInfo: text, profileInfoUpdatedAt: new Date() },
    { returnDocument: "after", projection: { profileInfo: 1, profileInfoUpdatedAt: 1 } }
  ).lean()
  if (!saved) throw new UserFacingError(NOT_FOUND)
  return { prompt: saved.profileInfo, defaultPrompt: "", isCustom: saved.profileInfo.trim().length > 0, updatedAt: saved.profileInfoUpdatedAt?.toISOString() ?? null }
}
