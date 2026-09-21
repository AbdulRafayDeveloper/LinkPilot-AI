"use client"

import { requestApi } from "@/lib/apiClient"
import { TASK_ATTACHMENT_MESSAGES } from "@/constants/taskAttachments"
import type { AiSource } from "@/types/ai"

// Daily Tasks and an employee's plan each write through their own module, so each has its own model order
export const TASK_DETAILS_AI_ENDPOINTS = {
  "daily-tasks": "/api/daily-tasks/generate",
  employees: "/api/employees/generate",
} as const

/**
 * A task's details written with AI, from its line, the tasks above it (the top one first) and what is
 * already written. Nothing is saved: the page puts the text in the editor, which saves it like
 * anything typed. A task with no line yet is refused here, before any call is made.
 */
export async function writeTaskDetails(
  module: keyof typeof TASK_DETAILS_AI_ENDPOINTS,
  input: { title: string; parents?: string[]; description?: string }
): Promise<{ details: string } & AiSource> {
  const title = input.title.trim()
  if (!title) throw new Error(TASK_ATTACHMENT_MESSAGES.generateNeedsTitle)
  const { data } = await requestApi<{ details: string } & AiSource>(
    TASK_DETAILS_AI_ENDPOINTS[module],
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parents: input.parents ?? [], description: input.description ?? "" }),
    },
    // Nothing is saved, so a dropped request is safe to send again
    { retry: true }
  )
  return data
}
