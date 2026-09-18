import { connectDatabase } from "@/lib/db"
import { UserModel } from "@/models/User"
import { getClient } from "@/services/clientMessaging/clients"
import type { Viewer } from "@/types/auth"

/**
 * The client the account last chose on Client Voices, kept on the account itself so the page opens
 * on it again in any browser. Only one of the account's own clients can be kept, and a client that
 * has since been deleted reads as none, so the page never opens on something that isn't there.
 */

/** The client to open on: its id, or "" when none was chosen or it no longer exists. */
export async function readClientChoice(viewer: Viewer): Promise<string> {
  await connectDatabase()
  const account = (await UserModel.findById(viewer.id, { clientVoicesClientId: 1 }).lean()) as { clientVoicesClientId?: string | null } | null
  const chosen = account?.clientVoicesClientId ?? ""
  if (!chosen) return ""
  return (await getClient(viewer, chosen)) ? chosen : ""
}

/**
 * Keeps a new choice. "" keeps none. Answers false, and keeps nothing, when the client is not one the
 * viewer may use (deleted meanwhile, or another account's).
 */
export async function saveClientChoice(viewer: Viewer, clientId: string): Promise<boolean> {
  if (clientId && !(await getClient(viewer, clientId))) return false
  await connectDatabase()
  await UserModel.updateOne({ _id: viewer.id }, { $set: { clientVoicesClientId: clientId || null } })
  return true
}
