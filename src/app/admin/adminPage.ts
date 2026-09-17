import { redirect } from "next/navigation"
import { getViewer } from "@/services/auth/viewer"
import { LOGIN_PATH } from "@/constants/auth"
import { HOME_HREF } from "@/components/ui/BrandLogo"

/**
 * The admin pages check the role before rendering anything, so a user who types the address is
 * sent to the app rather than shown an empty admin screen. The API behind them checks again.
 */
export async function requireAdminPage(path: string): Promise<void> {
  const viewer = await getViewer().catch(() => null)
  if (!viewer) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(path)}`)
  if (viewer.role !== "admin") redirect(HOME_HREF)
}
