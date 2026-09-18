import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import ReferenceContentClient from "./ReferenceContentClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("reference-content")

export default async function Page() {
  await requireFeaturePage("reference-content", "/reference-content")
  return <ReferenceContentClient />
}
