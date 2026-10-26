"use client"

import React from "react"
import { Globe } from "lucide-react"
import { GlobalPromptsPage, PromptCards } from "@/components/global-prompts/GlobalPromptsPage"
import { ModulePromptsPanel } from "@/components/admin/ModulePromptsPanel"
import { ADMIN_GLOBAL_PROMPTS, ADMIN_GLOBAL_PROMPTS_ENDPOINT } from "@/constants/globalPrompts"

/**
 * Administration → Global AI Prompts: every prompt the system writes with, and only an admin may
 * change them. Each module is listed with an Update button opening its own editor, then the prompt
 * that rewrites every module's result (Humanization). No tool page offers Update Prompt any more.
 */
export default function AdminGlobalPromptsClient() {
  return (
    <GlobalPromptsPage heading="Global AI Prompts" intro="Every prompt the tools write with. Only admins may change them, and a change applies to every account." icon={Globe}>
      <ModulePromptsPanel />
      <PromptCards
        note="The Humanization prompt rewrites the results of all 8 LinkedIn tools and Message Rewriter, for every account. Only admins see or change it."
        prompts={ADMIN_GLOBAL_PROMPTS}
        endpoint={ADMIN_GLOBAL_PROMPTS_ENDPOINT}
      />
    </GlobalPromptsPage>
  )
}
