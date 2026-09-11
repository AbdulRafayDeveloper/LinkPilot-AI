import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import KnowledgeBaseClient from "./KnowledgeBaseClient"

export const metadata: Metadata = {
  title: `AI Knowledge Base Manager | ${SITE_NAME}`,
  description: "Synchronize PDFs, CSVs, and markdown documentation to feed AI assistants. Track indexing tokens, similarity scores, and metadata mappings.",
  alternates: {
    canonical: `${SITE_URL}/knowledge-base`,
  },
}

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
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": `${SITE_URL}/`
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Knowledge Base",
                "item": `${SITE_URL}/knowledge-base`
              }
            ]
          })
        }}
      />
      <KnowledgeBaseClient />
    </>
  )
}
