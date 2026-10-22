import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import AccountClient from "./AccountClient"

export const metadata: Metadata = pageMetadata("account")

export default function Page() {
  return <AccountClient />
}
