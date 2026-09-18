import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import DailyTasksClient from "./DailyTasksClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("daily-tasks")

export default async function Page() {
  await requireFeaturePage("daily-tasks", "/daily-tasks")
  return <DailyTasksClient />
}
