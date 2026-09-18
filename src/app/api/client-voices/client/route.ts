import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { ClientChoiceSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { readClientChoice, saveClientChoice } from "@/services/clientVoices/clientChoice"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: the client the account last chose on Client Voices, "" for none. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Client choice retrieved", data: { clientId: await readClientChoice(auth.viewer) } })
  } catch (error: unknown) {
    console.error("GET Client Voices Choice Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.clientChoiceFailed) }, { status: 500 })
  }
}

/**
 * PUT { clientId }: remembers the client chosen on the page, "" for none. Only one of the account's
 * own clients can be kept (404 otherwise). Sending the same choice again changes nothing.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = ClientChoiceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.notYourClient }, { status: 400 })
  try {
    const saved = await saveClientChoice(auth.viewer, parsed.data.clientId)
    if (!saved) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.notYourClient }, { status: 404 })
    return NextResponse.json({ success: true, message: "Client choice saved", data: { clientId: parsed.data.clientId } })
  } catch (error: unknown) {
    console.error("PUT Client Voices Choice Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.clientChoiceFailed) }, { status: 500 })
  }
}
