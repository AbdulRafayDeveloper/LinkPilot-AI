import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingDetailClient from "./MeetingDetailClient"
import { requireFeaturePage } from "@/app/featurePage"

// The module's own metadata; the meeting's name is loaded in the page itself
export const metadata: Metadata = pageMetadata("meetings")

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireFeaturePage("meetings", "/meetings")
  const { id } = await params
  return <MeetingDetailClient id={id} />
}
