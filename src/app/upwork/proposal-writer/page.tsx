import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("upwork/proposal-writer")

export default async function Page() {
  await requireFeaturePage("upwork-proposal-writer", "/upwork/proposal-writer")
  return <ComingSoonPage toolId="upwork-proposal-writer" page="create" />
}
