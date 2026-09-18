import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingDetailClient from "./MeetingDetailClient"
import { requireFeaturePage } from "@/app/featurePage"

// One meeting is the user's own working page, not something search engines should hold
export const metadata: Metadata = { ...pageMetadata("meeting-planner"), robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireFeaturePage("meeting-planner", "/meeting-planner")
  const { id } = await params
  return <MeetingDetailClient meetingId={id} />
}
