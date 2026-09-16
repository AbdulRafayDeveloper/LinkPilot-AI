import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingPlannerClient from "./MeetingPlannerClient"

export const metadata: Metadata = pageMetadata("meeting-planner")

export default function Page() {
  return <MeetingPlannerClient />
}
