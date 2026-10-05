import { NextRequest, NextResponse } from "next/server"
import { toUserFacingMessage } from "@/lib/errors"
import { PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import { readPublicProject } from "@/services/clientProjects/projects"

export const dynamic = "force-dynamic"

/**
 * One client project, read only, reachable without signing in (src/proxy.ts lets /api/public/
 * through). The signed token in the address is the only key: it opens that one project, its tasks,
 * their images and their voice notes, and nothing else. There is no POST, PUT or DELETE here, so
 * the link can never change anything.
 *
 * It shows the project, the client's name and the tasks. It never says whose account it is, what
 * else that client has, or any id but the task's own.
 */

type RouteContext = { params: Promise<{ token: string }> }

// Every refusal about the link reads the same, so a guessed token learns nothing
const invalidLink = () => NextResponse.json({ success: false, message: PUBLIC_PROJECT_MESSAGES.invalid }, { status: 404 })
const noStore = { "Cache-Control": "no-store" }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { token } = await params
  try {
    const project = await readPublicProject(token)
    if (!project) return invalidLink()
    return NextResponse.json({ success: true, message: "Project retrieved", data: project }, { headers: noStore })
  } catch (error: unknown) {
    console.error("GET Public Project Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, PUBLIC_PROJECT_MESSAGES.invalid) }, { status: 500, headers: noStore })
  }
}
