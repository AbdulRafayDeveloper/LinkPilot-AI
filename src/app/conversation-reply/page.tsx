import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import ConversationReplyClient from "./ConversationReplyClient"

export const metadata: Metadata = {
  title: `Conversation Reply Analyzer | ${SITE_NAME}`,
  description: "Paste a LinkedIn conversation to get the next reply plus evidence-based client, relationship, buying-intent and risk signals.",
  alternates: {
    canonical: `${SITE_URL}/conversation-reply`,
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
                "name": "Conversation Reply Analyzer",
                "item": `${SITE_URL}/conversation-reply`
              }
            ]
          })
        }}
      />
      <ConversationReplyClient />
    </>
  )
}
