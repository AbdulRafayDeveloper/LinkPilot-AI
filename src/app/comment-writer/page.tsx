import type { Metadata } from "next"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import CommentWriterClient from "./CommentWriterClient"

export const metadata: Metadata = {
  title: `Comment Writer | ${SITE_NAME}`,
  description:
    "Write thoughtful, relevant LinkedIn comments from a pasted post or a screenshot, in six editable comment styles.",
  alternates: {
    canonical: `${SITE_URL}/comment-writer`,
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
                "name": "Comment Writer",
                "item": `${SITE_URL}/comment-writer`
              }
            ]
          })
        }}
      />
      <CommentWriterClient />
    </>
  )
}
