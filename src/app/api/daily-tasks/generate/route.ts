import type { NextRequest } from "next/server"
import { answerWriteDetails } from "@/services/dailyTasks/writeDetails"

export const dynamic = "force-dynamic"

/**
 * POST { title, parents?, description? }: a task's details written with AI, in Daily Tasks' model
 * order. Answers `{ details, provider, providers }`; nothing is saved until the editor saves it.
 */
export async function POST(req: NextRequest) {
  return answerWriteDetails(req, "daily-tasks")
}
