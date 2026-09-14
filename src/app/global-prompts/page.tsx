import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import GlobalPromptsClient from "./GlobalPromptsClient"

export const metadata: Metadata = pageMetadata("global-prompts")

export default function Page() {
  return <GlobalPromptsClient />
}
