import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { toUserFacingMessage } from "@/lib/errors"
import { FINANCE_LOCK_MESSAGES, FINANCE_PASSWORD_MAX_LENGTH, FINANCE_PASSWORD_MIN_LENGTH } from "@/constants/financeLock"
import {
  changeFinancePassword,
  endAllUnlocks,
  endThisUnlock,
  lockStatus,
  resetFinancePassword,
  setFinancePassword,
  unlockFinance,
  type LockResult,
} from "@/services/finance/lock"
import { isSecureRequest, requireViewer } from "@/services/auth/viewer"

export const dynamic = "force-dynamic"

const NewPassword = z
  .string()
  .min(FINANCE_PASSWORD_MIN_LENGTH, FINANCE_LOCK_MESSAGES.tooShort)
  .max(FINANCE_PASSWORD_MAX_LENGTH, FINANCE_LOCK_MESSAGES.tooLong)
const Given = z.string().min(1, FINANCE_LOCK_MESSAGES.wrong).max(FINANCE_PASSWORD_MAX_LENGTH, FINANCE_LOCK_MESSAGES.wrong)

// A new Finance password and the same typed again, checked here as well as on the page
const NewPasswordSchema = z
  .object({ password: NewPassword, confirmPassword: z.string() })
  .refine((body) => body.password === body.confirmPassword, { message: FINANCE_LOCK_MESSAGES.mismatch, path: ["confirmPassword"] })

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock") }),
  z.object({ action: z.literal("lock-all") }),
  z.object({ action: z.literal("unlock"), password: Given }),
  z.object({ action: z.literal("set"), password: z.string(), confirmPassword: z.string() }),
  z.object({ action: z.literal("change"), currentPassword: Given, password: z.string(), confirmPassword: z.string() }),
  z.object({ action: z.literal("reset"), accountPassword: Given, password: z.string(), confirmPassword: z.string() }),
])

const answer = (result: LockResult) =>
  result.ok
    ? NextResponse.json({ success: true, message: result.message, data: { unlocked: true } })
    : NextResponse.json({ success: false, message: result.message }, { status: result.status })

/**
 * GET: whether a Finance password is set and whether this browser has Finance open. Nothing else is
 * ever said about it, so the page knows which screen to show and nothing more.
 */
export async function GET() {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const { hasPassword, unlocked } = await lockStatus(auth.viewer)
    return NextResponse.json({ success: true, message: "Finance lock", data: { hasPassword, unlocked } }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("GET Finance Lock Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FINANCE_LOCK_MESSAGES.failed) }, { status: 500 })
  }
}

/**
 * POST { action }: "set" the first Finance password, "unlock" with it, "change" it (with the one in
 * use now), "reset" a forgotten one (with the password the person signs in with), "lock" this
 * device, or "lock-all" to end Finance on every device the account has it open on.
 * New passwords come with a confirmation, checked here as well as on the page.
 */
export async function POST(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || FINANCE_LOCK_MESSAGES.failed }, { status: 400 })
    const body = parsed.data
    const secure = isSecureRequest(req)
    if (body.action === "lock") {
      await endThisUnlock()
      return NextResponse.json({ success: true, message: FINANCE_LOCK_MESSAGES.lockedNow, data: { unlocked: false } })
    }
    // Every device at once, this one included: each needs the password again
    if (body.action === "lock-all") {
      await endAllUnlocks(auth.viewer)
      return NextResponse.json({ success: true, message: FINANCE_LOCK_MESSAGES.lockedEverywhere, data: { unlocked: false } })
    }
    if (body.action === "unlock") return answer(await unlockFinance(auth.viewer, body.password, secure))
    const checked = NewPasswordSchema.safeParse({ password: body.password, confirmPassword: body.confirmPassword })
    if (!checked.success) return NextResponse.json({ success: false, message: checked.error.issues[0]?.message || FINANCE_LOCK_MESSAGES.failed }, { status: 400 })
    if (body.action === "set") return answer(await setFinancePassword(auth.viewer, body.password, secure))
    if (body.action === "change") return answer(await changeFinancePassword(auth.viewer, body.currentPassword, body.password, secure))
    return answer(await resetFinancePassword(auth.viewer, body.accountPassword, body.password, secure))
  } catch (error: unknown) {
    console.error("POST Finance Lock Exception:", error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, FINANCE_LOCK_MESSAGES.failed) }, { status: 500 })
  }
}
