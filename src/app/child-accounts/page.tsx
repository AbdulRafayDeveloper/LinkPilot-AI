import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { CHILDREN_HREF, CHILD_ACCOUNTS_TOOL } from "@/constants/children"
import { requireFeaturePage } from "../featurePage"
import ChildAccountsClient from "./ChildAccountsClient"

export const metadata: Metadata = pageMetadata("child-accounts")
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page() {
  // A child account has this tool in its list of tools it may not use, so it is sent away here
  await requireFeaturePage(CHILD_ACCOUNTS_TOOL.id, CHILDREN_HREF)
  return <ChildAccountsClient />
}
