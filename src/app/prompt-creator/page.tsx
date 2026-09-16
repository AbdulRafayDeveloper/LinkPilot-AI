import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import PromptCreatorClient from "./PromptCreatorClient"

export const metadata: Metadata = pageMetadata("prompt-creator")

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
            ],
          }),
        }}
      />
      <PromptCreatorClient />
    </>
  )
}
