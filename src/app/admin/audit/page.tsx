import { Suspense } from "react"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { AUDIT_HREF } from "@/constants/admin"
import { requireAdminPage } from "../adminPage"
import AuditClient from "./AuditClient"

export const metadata: Metadata = pageMetadata("admin/audit")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  await requireAdminPage(AUDIT_HREF)
  return (
    <Suspense>
      <AuditClient />
    </Suspense>
  )
}
