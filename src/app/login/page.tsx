import type { Metadata } from "next"
import { env } from "@/config/env"
import { pageMetadata } from "@/lib/metadata"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { AuthForm } from "@/components/auth/AuthForm"

export const metadata: Metadata = pageMetadata("login")
// Whether sign-up is open is read on each request, so changing ALLOW_SIGNUP needs no rebuild
export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <AuthForm mode="login" signupEnabled={env.ALLOW_SIGNUP === "true"} />
    </AuthLayout>
  )
}
