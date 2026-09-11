import type { Metadata } from "next"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import GlobalPromptsClient from "./GlobalPromptsClient"

export const metadata: Metadata = {
  title: `Global AI Prompts | ${SITE_NAME}`,
  description: "Password-protected prompts shared across LinkPilot AI: profile information and text humanization.",
  alternates: {
    canonical: `${SITE_URL}/global-prompts`,
  },
  // A private workspace page, not one of the public tools
  robots: { index: false, follow: false },
}

export default function Page() {
  return <GlobalPromptsClient />
}
