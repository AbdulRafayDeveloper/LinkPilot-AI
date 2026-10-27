import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("hubstaff-talent/related-video")

export default async function Page() {
  await requireFeaturePage("hubstaff-related-video", "/hubstaff-talent/related-video")
  return <ComingSoonPage toolId="hubstaff-related-video" page="create" />
}
