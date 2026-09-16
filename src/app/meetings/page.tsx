import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import MeetingsClient from "./MeetingsClient"

export const metadata: Metadata = pageMetadata("meetings")

export default function Page() {
  return <MeetingsClient />
}
