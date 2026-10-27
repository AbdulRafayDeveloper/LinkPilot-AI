import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("upwork/client-conversation/history")

export default async function Page() {
  await requireFeaturePage("upwork-client-conversation", "/upwork/client-conversation/history")
  return <ComingSoonPage toolId="upwork-client-conversation" page="history" />
}
