import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import InspectorClient from "./InspectorClient"

export const metadata: Metadata = {
  title: `AI Agent Execution Inspector | ${SITE_NAME}`,
  description: "Audit prompt injections, trace ReAct model routing execution lifecycles, and view similarity scores for retrieved context blocks.",
  alternates: {
    canonical: `${SITE_URL}/inspector`,
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
                "name": "Inspector",
                "item": `${SITE_URL}/inspector`
              }
            ]
          })
        }}
      />
      <InspectorClient />
    </>
  )
}
