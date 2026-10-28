import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { BUDGET_HREF, BUDGET_TOOL, MONTH_PATTERN } from "@/constants/budget"
import BudgetMonthClient from "./BudgetMonthClient"

// One month of someone's own money is a working page, not something search engines should hold
export const metadata: Metadata = { ...pageMetadata(BUDGET_HREF.slice(1)), robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ month: string }> }) {
  await requireFeaturePage(BUDGET_TOOL.id, BUDGET_HREF)
  const { month } = await params
  if (!MONTH_PATTERN.test(month)) redirect(BUDGET_HREF)
  return <BudgetMonthClient monthId={month} />
}
