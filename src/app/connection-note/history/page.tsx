import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import { SavedOutputsView } from "@/components/saved-outputs/SavedOutputsView"
import { getSavedOutputTool } from "@/constants/savedOutputs"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("connection-note/history")

export default async function Page() {
  await requireFeaturePage("connection-note", "/connection-note")
  return (
    <>
      {/* Breadcrumb schema markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/` },
              { "@type": "ListItem", "position": 2, "name": "Connection Note", "item": `${SITE_URL}/connection-note` },
              { "@type": "ListItem", "position": 3, "name": getSavedOutputTool("connection-note")?.heading, "item": `${SITE_URL}/connection-note/history` },
            ],
          }),
        }}
      />
      <SavedOutputsView toolId="connection-note" />
    </>
  )
}
