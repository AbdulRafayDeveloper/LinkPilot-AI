import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import ProjectDetailClient from "./ProjectDetailClient"
import { requireFeaturePage } from "@/app/featurePage"

// One project is the user's own working page, not something search engines should hold
export const metadata: Metadata = { ...pageMetadata("client-projects"), robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireFeaturePage("client-projects", "/client-projects")
  const { id } = await params
  return <ProjectDetailClient projectId={id} />
}
