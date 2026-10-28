import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { FinanceGate } from "@/components/finance/FinanceGate"
import { ComingSoonPage } from "@/components/ui/ComingSoonPage"

export const metadata: Metadata = pageMetadata("finance/investment-plans")

export default async function Page() {
  await requireFeaturePage("finance-investment-plans", "/finance/investment-plans")
  return (
    <FinanceGate>
      <ComingSoonPage toolId="finance-investment-plans" page="create" />
    </FinanceGate>
  )
}
