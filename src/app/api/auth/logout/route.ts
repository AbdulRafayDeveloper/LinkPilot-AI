import { NextResponse, type NextRequest } from "next/server"
import { endSession, getViewer } from "@/services/auth/viewer"
import { clientInfo, recordLoginEvent } from "@/services/auth/audit"

export const dynamic = "force-dynamic"

/** POST: Signs this browser out, and notes it in the audit trail. Harmless when it was not signed in. */
export async function POST(req: NextRequest) {
  // Whoever is signing out is read first; a database problem here must not keep anyone signed in
  const viewer = await getViewer().catch(() => null)
  if (viewer) await recordLoginEvent("sign-out", { userId: viewer.id, email: viewer.email, name: viewer.name }, clientInfo(req))
  await endSession()
  return NextResponse.json({ success: true, message: "Signed out.", data: { signedOut: true } })
}
