import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import BatchDetailClient from "./BatchDetailClient"
import { requireFeaturePage } from "@/app/featurePage"

// One batch is the user's own record of a client's voice messages, not something search engines hold
export const metadata: Metadata = { ...pageMetadata("client-voices"), robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireFeaturePage("client-voices", "/client-voices")
  const { id } = await params
  return <BatchDetailClient batchId={id} />
}
