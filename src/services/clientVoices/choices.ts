import { connectDatabase } from "@/lib/db"
import { UserModel } from "@/models/User"
import { getClient } from "@/services/clientMessaging/clients"
import type { Viewer } from "@/types/auth"
import type { VoiceChoices } from "@/types/clientVoices"

/**
 * The two choices Client Voices opens on, kept on the account itself so the page finds them again
 * in any browser: the client a batch is kept under, and whether a batch is kept at all.
 *
 * They are **choices, not work**: nothing but the user changes them, so a reload, a new tab and the
 * next visit all open on what was left, the way the sidebar remembers being collapsed. Only one of
 * the account's own clients can be kept, and a client deleted since reads as none, so the page never
 * opens on something that isn't there.
 */

export async function readChoices(viewer: Viewer): Promise<VoiceChoices> {
  await connectDatabase()
  const account = (await UserModel.findById(viewer.id, { clientVoicesClientId: 1, clientVoicesTemporary: 1 }).lean()) as {
    clientVoicesClientId?: string | null
    clientVoicesTemporary?: boolean | null
  } | null
  const chosen = account?.clientVoicesClientId ?? ""
  return {
    clientId: chosen && (await getClient(viewer, chosen)) ? chosen : "",
    isTemporary: account?.clientVoicesTemporary === true,
  }
}

/**
 * Keeps a new choice. Either may be sent on its own, so changing one says nothing about the other.
 * Answers false, and keeps nothing, when the client is not one the viewer may use (deleted
 * meanwhile, or another account's).
 */
export async function saveChoices(viewer: Viewer, choices: { clientId?: string; isTemporary?: boolean }): Promise<boolean> {
  if (choices.clientId && !(await getClient(viewer, choices.clientId))) return false
  await connectDatabase()
  await UserModel.updateOne(
    { _id: viewer.id },
    {
      $set: {
        ...(choices.clientId !== undefined ? { clientVoicesClientId: choices.clientId || null } : {}),
        ...(choices.isTemporary !== undefined ? { clientVoicesTemporary: choices.isTemporary } : {}),
      },
    }
  )
  return true
}
