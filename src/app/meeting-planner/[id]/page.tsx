import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingDetailClient from "./MeetingDetailClient"

// One meeting is the user's own working page, not something search engines should hold
export const metadata: Metadata = { ...pageMetadata("meeting-planner"), robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MeetingDetailClient meetingId={id} />
}
