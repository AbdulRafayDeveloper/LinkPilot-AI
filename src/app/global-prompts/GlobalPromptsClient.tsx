"use client"

import React from "react"
import { GlobalPromptsPage } from "@/components/global-prompts/GlobalPromptsPage"
import { GLOBAL_PROMPTS_ENDPOINT, SHARED_GLOBAL_PROMPTS } from "@/constants/globalPrompts"

/** Global AI Prompts: the prompts every account may change. Humanization is an admin's, under Administration. */
export default function GlobalPromptsClient() {
  return (
    <GlobalPromptsPage
      heading="Global AI Prompts"
      intro="Shared prompts for LinkPilot AI, kept in one place."
      note="Rafay Profile Info gives Post Comment Replies your real experience, projects and numbers. It is shared by every account, so a change here changes it for everyone."
      prompts={SHARED_GLOBAL_PROMPTS}
      endpoint={GLOBAL_PROMPTS_ENDPOINT}
    />
  )
}
