import { Suspense } from "react"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import GlobalPromptsClient from "./GlobalPromptsClient"

export const metadata: Metadata = pageMetadata("global-prompts")

export default function Page() {
  // The open tab is read from the address, which a client component may only do inside Suspense
  return (
    <Suspense>
      <GlobalPromptsClient />
    </Suspense>
  )
}
