import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import RecordMeetingClient from "./RecordMeetingClient"
import { requireFeaturePage } from "@/app/featurePage"

// Part of Meeting Notes to Tasks, so it shares the module's metadata and its access switch
export const metadata: Metadata = pageMetadata("meetings")

export default async function Page() {
  await requireFeaturePage("meetings", "/meetings")
  return <RecordMeetingClient />
}
