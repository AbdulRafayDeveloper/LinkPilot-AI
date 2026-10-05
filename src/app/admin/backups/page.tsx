import { Suspense } from "react"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { BACKUPS_HREF } from "@/constants/backups"
import { requireAdminPage } from "../adminPage"
import BackupsClient from "./BackupsClient"

export const metadata: Metadata = pageMetadata("admin/backups")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  await requireAdminPage(BACKUPS_HREF)
  return (
    <Suspense>
      <BackupsClient />
    </Suspense>
  )
}
