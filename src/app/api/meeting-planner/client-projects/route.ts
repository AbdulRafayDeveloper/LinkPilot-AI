import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { isFeatureDisabled } from "@/lib/featureAccess"
import { CLIENTS_TOOL, CLIENT_PROJECT_STATUS_IDS } from "@/constants/clients"
import { MEETING_PROJECT_MESSAGES, MEETING_PROJECT_SEARCH_MAX_LENGTH } from "@/constants/meetingPlanner"
import { listMeetingProjects } from "@/services/meetingPlanner/clientProjects"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** Anything a hand-written query might carry is read as "not filtered" rather than refused. */
const QuerySchema = z.object({
  search: z.string().trim().max(MEETING_PROJECT_SEARCH_MAX_LENGTH).catch(""),
  client: z
    .string()
    .regex(/^[0-9a-f]{24}$/i)
    .catch(""),
  status: z.enum(["", ...CLIENT_PROJECT_STATUS_IDS]).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
})

/**
 * GET (?search=&client=&status=&page=): the client projects a meeting may be connected to, one page
 * at a time, searched by project or client name and narrowed by client and status in the database.
 * It sits under Meeting Planner, so that switch covers it; the projects are Clients Management's, so
 * with that tool off for the account there are none to offer and it says so.
 */
export async function GET(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  if (isFeatureDisabled(auth.viewer, CLIENTS_TOOL.id)) {
    return NextResponse.json({ success: false, message: MEETING_PROJECT_MESSAGES.unavailable }, { status: 403 })
  }
  try {
    const params = req.nextUrl.searchParams
    const query = QuerySchema.parse({
      search: params.get("search") ?? "",
      client: params.get("client") ?? "",
      status: params.get("status") ?? "",
      page: params.get("page") ?? 1,
    })
    const page = await listMeetingProjects(auth.viewer, { search: query.search, clientId: query.client, status: query.status, page: query.page })
    return NextResponse.json({ success: true, message: "Projects retrieved", data: page })
  } catch (error: unknown) {
    console.error("GET Meeting Planner Projects Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, MEETING_PROJECT_MESSAGES.loadFailed) }, { status: 500 })
  }
}
