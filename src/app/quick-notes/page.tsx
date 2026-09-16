import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import QuickNotesClient from "./QuickNotesClient"

export const metadata: Metadata = pageMetadata("quick-notes")

export default function Page() {
  return <QuickNotesClient />
}
