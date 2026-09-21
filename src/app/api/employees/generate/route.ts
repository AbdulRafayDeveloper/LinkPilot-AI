import type { NextRequest } from "next/server"
import { answerWriteDetails } from "@/services/dailyTasks/writeDetails"

export const dynamic = "force-dynamic"

/**
 * POST { title, parents?, description? }: a plan task's details written with AI, in Employees
 * Management's model order. Answers `{ details, provider, providers }`; the plan editor puts the text
 * in the task and saves it with the plan, like anything typed.
 */
export async function POST(req: NextRequest) {
  return answerWriteDetails(req, "employees")
}
