import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("hubstaff-talent/client-conversation/history")

export default async function Page() {
  await requireFeaturePage("hubstaff-client-conversation", "/hubstaff-talent/client-conversation/history")
  return <ComingSoonPage toolId="hubstaff-client-conversation" page="history" />
}
