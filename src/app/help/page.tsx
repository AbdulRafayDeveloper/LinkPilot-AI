import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import HelpClient from "./HelpClient"

export const metadata: Metadata = pageMetadata("help")

export default function Page() {
  return <HelpClient />
}
