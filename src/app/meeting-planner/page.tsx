import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingPlannerClient from "./MeetingPlannerClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("meeting-planner")

export default async function Page() {
  await requireFeaturePage("meeting-planner", "/meeting-planner")
  return <MeetingPlannerClient />
}
