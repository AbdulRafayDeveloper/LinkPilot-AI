import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { ADMIN_GLOBAL_PROMPTS_HREF } from "@/constants/globalPrompts"
import { requireAdminPage } from "../adminPage"
import AdminGlobalPromptsClient from "./AdminGlobalPromptsClient"

export const metadata: Metadata = pageMetadata("admin/global-prompts")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  await requireAdminPage(ADMIN_GLOBAL_PROMPTS_HREF)
  return <AdminGlobalPromptsClient />
}
