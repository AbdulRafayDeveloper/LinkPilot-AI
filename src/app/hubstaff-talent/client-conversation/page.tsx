import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("hubstaff-talent/client-conversation")

export default async function Page() {
  await requireFeaturePage("hubstaff-client-conversation", "/hubstaff-talent/client-conversation")
  return <ComingSoonPage toolId="hubstaff-client-conversation" page="create" />
}
