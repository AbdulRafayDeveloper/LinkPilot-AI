"use client"

import React from "react"
import { GlobalPromptsPage } from "@/components/global-prompts/GlobalPromptsPage"
import { ADMIN_GLOBAL_PROMPTS, ADMIN_GLOBAL_PROMPTS_ENDPOINT } from "@/constants/globalPrompts"

/** Administration → Global AI Prompts: the prompts only an admin may read and change (Humanization). */
export default function AdminGlobalPromptsClient() {
  return (
    <GlobalPromptsPage
      heading="Global AI Prompts"
      intro="The prompts only an admin may change."
      note="The Humanization prompt rewrites the results of all 8 LinkedIn tools and Message Rewriter, for every account. Only admins see or change it."
      prompts={ADMIN_GLOBAL_PROMPTS}
      endpoint={ADMIN_GLOBAL_PROMPTS_ENDPOINT}
    />
  )
}
