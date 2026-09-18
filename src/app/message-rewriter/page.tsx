import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import MessageRewriterClient from "./MessageRewriterClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("message-rewriter")

export default async function Page() {
  await requireFeaturePage("message-rewriter", "/message-rewriter")
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
              { "@type": "ListItem", "position": 2, "name": "Message Rewriter", "item": `${SITE_URL}/message-rewriter` },
            ],
          }),
        }}
      />
      <MessageRewriterClient />
    </>
  )
}
