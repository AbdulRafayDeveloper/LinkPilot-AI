import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { MODEL_PRIORITY_HREF } from "@/constants/admin"
import { requireAdminPage } from "../adminPage"
import ModelPriorityClient from "./ModelPriorityClient"

export const metadata: Metadata = pageMetadata("admin/models")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  await requireAdminPage(MODEL_PRIORITY_HREF)
  return <ModelPriorityClient />
}
