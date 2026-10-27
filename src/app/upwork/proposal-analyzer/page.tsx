import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("upwork/proposal-analyzer")

export default async function Page() {
  await requireFeaturePage("upwork-proposal-analyzer", "/upwork/proposal-analyzer")
  return <ComingSoonPage toolId="upwork-proposal-analyzer" page="create" />
}
