import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import { SavedOutputsView } from "@/components/saved-outputs/SavedOutputsView"
import { getSavedOutputTool } from "@/constants/savedOutputs"

export const metadata: Metadata = pageMetadata("conversation-reply/history")

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
              { "@type": "ListItem", "position": 2, "name": "Conversation Reply", "item": `${SITE_URL}/conversation-reply` },
              { "@type": "ListItem", "position": 3, "name": getSavedOutputTool("conversation-reply")?.heading, "item": `${SITE_URL}/conversation-reply/history` },
            ],
          }),
        }}
      />
      <SavedOutputsView toolId="conversation-reply" />
    </>
  )
}
