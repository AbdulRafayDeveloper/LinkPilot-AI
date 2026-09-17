import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import { SavedOutputsView } from "@/components/saved-outputs/SavedOutputsView"
import { getSavedOutputTool } from "@/constants/savedOutputs"

export const metadata: Metadata = pageMetadata("prompt-creator/history")

export default function Page() {
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
              { "@type": "ListItem", "position": 2, "name": "Prompt Creator", "item": `${SITE_URL}/prompt-creator` },
              { "@type": "ListItem", "position": 3, "name": getSavedOutputTool("prompt-creator")?.heading, "item": `${SITE_URL}/prompt-creator/history` },
            ],
          }),
        }}
      />
      <SavedOutputsView toolId="prompt-creator" />
    </>
  )
}
