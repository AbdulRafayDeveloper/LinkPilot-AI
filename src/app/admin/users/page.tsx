import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { USERS_HREF } from "@/constants/admin"
import { requireAdminPage } from "../adminPage"
import UsersClient from "./UsersClient"

export const metadata: Metadata = pageMetadata("admin/users")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  await requireAdminPage(USERS_HREF)
  return <UsersClient />
}
