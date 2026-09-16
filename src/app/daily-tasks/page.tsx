import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import DailyTasksClient from "./DailyTasksClient"

export const metadata: Metadata = pageMetadata("daily-tasks")

export default function Page() {
  return <DailyTasksClient />
}
