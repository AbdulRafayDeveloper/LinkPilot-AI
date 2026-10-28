import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { FinanceGate } from "@/components/finance/FinanceGate"
import { BUDGET_HREF, BUDGET_TOOL } from "@/constants/budget"
import BudgetOverviewClient from "./BudgetOverviewClient"

export const metadata: Metadata = pageMetadata(BUDGET_HREF.slice(1))

export default async function Page() {
  await requireFeaturePage(BUDGET_TOOL.id, BUDGET_HREF)
  return (
    <FinanceGate>
      <BudgetOverviewClient />
    </FinanceGate>
  )
}
