import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { VoiceChoicesSchema } from "@/lib/validation/clientVoices"
import { CLIENT_VOICES_MESSAGES } from "@/constants/clientVoices"
import { readChoices, saveChoices } from "@/services/clientVoices/choices"
import { requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

/** GET: the two choices the page opens on, the client ("" for none) and whether a batch is kept. */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    return NextResponse.json({ success: true, message: "Choices retrieved", data: await readChoices(auth.viewer) })
  } catch (error: unknown) {
    console.error("GET Client Voices Choices Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.clientChoiceFailed) }, { status: 500 })
  }
}

/**
 * PUT { clientId?, isTemporary? }: remembers a choice made on the page. Either may be sent on its
 * own. Only one of the account's own clients can be kept (404 otherwise), and sending the same
 * choice again changes nothing.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = VoiceChoicesSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.notYourClient }, { status: 400 })
  try {
    const saved = await saveChoices(auth.viewer, parsed.data)
    if (!saved) return NextResponse.json({ success: false, message: CLIENT_VOICES_MESSAGES.notYourClient }, { status: 404 })
    return NextResponse.json({ success: true, message: "Choice saved", data: await readChoices(auth.viewer) })
  } catch (error: unknown) {
    console.error("PUT Client Voices Choices Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, CLIENT_VOICES_MESSAGES.clientChoiceFailed) }, { status: 500 })
  }
}
