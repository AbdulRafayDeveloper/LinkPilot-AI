import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import BatchHistoryClient from "./BatchHistoryClient"
import { requireFeaturePage } from "@/app/featurePage"

// Its SEO entry is derived from the tool's own dropdown link (constants/seo.ts), so it is not indexable
export const metadata: Metadata = pageMetadata("client-voices/history")

export default async function Page() {
  await requireFeaturePage("client-voices", "/client-voices/history")
  return <BatchHistoryClient />
}
