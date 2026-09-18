import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import QuickNotesClient from "./QuickNotesClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("quick-notes")

export default async function Page() {
  await requireFeaturePage("quick-notes", "/quick-notes")
  return <QuickNotesClient />
}
