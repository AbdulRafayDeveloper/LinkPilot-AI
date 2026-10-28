import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { requireFeaturePage } from "@/app/featurePage"
import { FINANCE_BOT_HREF, FINANCE_BOT_TOOL } from "@/constants/financeBot"
import FinanceBotClient from "./FinanceBotClient"

export const metadata: Metadata = pageMetadata(FINANCE_BOT_HREF.slice(1))

export default async function Page() {
  await requireFeaturePage(FINANCE_BOT_TOOL.id, FINANCE_BOT_HREF)
  return <FinanceBotClient />
}
