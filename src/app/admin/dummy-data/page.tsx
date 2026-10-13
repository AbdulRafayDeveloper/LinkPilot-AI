import { Suspense } from "react"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { DUMMY_DATA_HREF } from "@/constants/dummyData"
import { requireAdminPage } from "../adminPage"
import DummyDataClient from "./DummyDataClient"

export const metadata: Metadata = pageMetadata("admin/dummy-data")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  await requireAdminPage(DUMMY_DATA_HREF)
  return (
    <Suspense>
      <DummyDataClient />
    </Suspense>
  )
}
