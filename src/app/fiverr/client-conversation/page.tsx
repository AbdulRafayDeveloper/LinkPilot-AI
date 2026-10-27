import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("fiverr/client-conversation")

export default async function Page() {
  await requireFeaturePage("fiverr-client-conversation", "/fiverr/client-conversation")
  return <ComingSoonPage toolId="fiverr-client-conversation" page="create" />
}
