import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("finance/budget-management")

export default async function Page() {
  await requireFeaturePage("finance-budget-management", "/finance/budget-management")
  return <ComingSoonPage toolId="finance-budget-management" page="create" />
}
