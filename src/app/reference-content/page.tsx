import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import ReferenceContentClient from "./ReferenceContentClient"

export const metadata: Metadata = pageMetadata("reference-content")

export default function Page() {
  return <ReferenceContentClient />
}
