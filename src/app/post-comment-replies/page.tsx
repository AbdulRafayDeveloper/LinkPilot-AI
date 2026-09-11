import type { Metadata } from "next"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import PostCommentRepliesClient from "./PostCommentRepliesClient"

export const metadata: Metadata = {
  title: `Post Comment Replies | ${SITE_NAME}`,
  description: "Paste a LinkedIn post and its comments, choose your context and reply style, and generate a natural reply to the right comment.",
  alternates: {
    canonical: `${SITE_URL}/post-comment-replies`,
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
                "name": "Post Comment Replies",
                "item": `${SITE_URL}/post-comment-replies`
              }
            ]
          })
        }}
      />
      <PostCommentRepliesClient />
    </>
  )
}
