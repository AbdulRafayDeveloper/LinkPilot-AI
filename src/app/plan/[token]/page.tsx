import type { Metadata } from "next"
import { SITE_NAME } from "@/config/site"
import PublicPlanClient from "./PublicPlanClient"

// A private link: never indexed, never followed, and the token in the address is never sent on as a referrer
export const metadata: Metadata = {
  title: `Daily plan | ${SITE_NAME}`,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <PublicPlanClient token={(await params).token} />
}
