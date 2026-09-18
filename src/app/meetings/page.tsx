import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingsClient from "./MeetingsClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("meetings")

export default async function Page() {
  await requireFeaturePage("meetings", "/meetings")
  return <MeetingsClient />
}
