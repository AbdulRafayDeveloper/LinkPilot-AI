import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import PostImageCreatorClient from "./PostImageCreatorClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("post-image-creator")

export default async function Page() {
  await requireFeaturePage("post-image-creator", "/post-image-creator")
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
              { "@type": "ListItem", "position": 2, "name": "Post Image Creator", "item": `${SITE_URL}/post-image-creator` },
            ],
          }),
        }}
      />
      <PostImageCreatorClient />
    </>
  )
}
