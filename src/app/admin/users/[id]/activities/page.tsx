import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { ActivityLogView } from "@/components/activity-logs/ActivityLogView"
import { adminActivitiesHref } from "@/constants/activityLogs"
import { requireAdminPage } from "../../../adminPage"

// One account's activities are an admin's working page, never something to find
export const metadata: Metadata = { ...pageMetadata("admin/users"), title: "User Activities", robots: { index: false, follow: false } }
// Who is asking decides whether this page exists for them, so it is never prerendered
export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdminPage(adminActivitiesHref(id))
  return <ActivityLogView mode="admin" userId={id} />
}
