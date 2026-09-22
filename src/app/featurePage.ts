import { redirect } from "next/navigation"
import { getViewer } from "@/services/auth/viewer"
import { LOGIN_PATH } from "@/constants/auth"
import { homeFor } from "@/lib/homePath"
import { isFeatureDisabled } from "@/lib/featureAccess"

/**
 * A tool's page checks, before it renders anything, that the account may still use it: a user
 * who types the address of a tool an admin has turned off for them is sent back to the app rather
 * than shown a page whose every request would be refused. The API behind it checks again, so this
 * is the courtesy and `requireViewer` is the protection.
 *
 * It mirrors `app/admin/adminPage.ts`, which does the same for the admin area's role check.
 */
export async function requireFeaturePage(toolId: string, path: string): Promise<void> {
  const viewer = await getViewer().catch(() => null)
  if (!viewer) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(path)}`)
  if (isFeatureDisabled(viewer, toolId)) redirect(homeFor(viewer.role === "admin", viewer.disabledTools))
}
