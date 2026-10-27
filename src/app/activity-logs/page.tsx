import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { ActivityLogView } from "@/components/activity-logs/ActivityLogView"
import { requireFeaturePage } from "@/app/featurePage"
import { ACTIVITY_LOGS_HREF, ACTIVITY_LOGS_TOOL } from "@/constants/activityLogs"

export const metadata: Metadata = pageMetadata(ACTIVITY_LOGS_HREF.slice(1))

export default async function Page() {
  await requireFeaturePage(ACTIVITY_LOGS_TOOL.id, ACTIVITY_LOGS_HREF)
  return <ActivityLogView mode="own" />
}
