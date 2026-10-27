import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("hubstaff-talent/apply-on-job")

export default async function Page() {
  await requireFeaturePage("hubstaff-apply-on-job", "/hubstaff-talent/apply-on-job")
  return <ComingSoonPage toolId="hubstaff-apply-on-job" page="create" />
}
