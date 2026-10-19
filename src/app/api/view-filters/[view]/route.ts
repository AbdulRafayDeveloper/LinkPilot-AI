import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { isFilterView, SAVED_FILTERS_MESSAGES } from "@/constants/savedFilters"
import { readFilters, saveFilters } from "@/services/savedFilters"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/**
 * The filters one page was last left on, kept on the account so every list opens the way its user
 * left it (`constants/savedFilters.ts`).
 *
 * It serves every page that has filters, so it belongs to no one tool and is in `SHARED_API_PATHS`.
 * That costs nothing: what is kept here is which filters are on, never any record, and the data
 * itself still comes from each tool's own API, which the feature gate judges as it always did.
 */
type RouteContext = { params: Promise<{ view: string }> }

const unknownView = () => NextResponse.json({ success: false, message: SAVED_FILTERS_MESSAGES.unknownView }, { status: 404 })

/** GET: what this page is filtered on, `{}` when nothing is. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { view } = await params
    if (!isFilterView(view)) return unknownView()
    return NextResponse.json({ success: true, message: "Filters retrieved", data: await readFilters(auth.viewer, view) })
  } catch (error: unknown) {
    console.error("GET View Filters Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, SAVED_FILTERS_MESSAGES.saveFailed) }, { status: 500 })
  }
}

/**
 * PUT `{ …filters }`: keeps what this page is filtered on now. Only the keys the page really has are
 * kept, and an empty body is how "nothing is filtered" is remembered, so Clear filters is saved too.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { view } = await params
    if (!isFilterView(view)) return unknownView()
    const body = await req.json().catch(() => null)
    return NextResponse.json({ success: true, message: "Filters saved", data: await saveFilters(auth.viewer, view, body) })
  } catch (error: unknown) {
    console.error("PUT View Filters Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, SAVED_FILTERS_MESSAGES.saveFailed) }, { status: 500 })
  }
}
