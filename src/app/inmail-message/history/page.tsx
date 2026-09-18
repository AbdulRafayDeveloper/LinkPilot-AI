import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import { SavedOutputsView } from "@/components/saved-outputs/SavedOutputsView"
import { getSavedOutputTool } from "@/constants/savedOutputs"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("inmail-message/history")

export default async function Page() {
  await requireFeaturePage("inmail-composer", "/inmail-message")
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
              { "@type": "ListItem", "position": 2, "name": "InMail Message", "item": `${SITE_URL}/inmail-message` },
              { "@type": "ListItem", "position": 3, "name": getSavedOutputTool("inmail-message")?.heading, "item": `${SITE_URL}/inmail-message/history` },
            ],
          }),
        }}
      />
      <SavedOutputsView toolId="inmail-message" />
    </>
  )
}
