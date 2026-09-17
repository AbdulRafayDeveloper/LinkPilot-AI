import React from "react"
import Image from "next/image"
import { History, ShieldCheck, Sparkles } from "lucide-react"
import { SITE_LOGO_PNG, SITE_PURPOSE, SITE_SHORT_NAME } from "@/config/site"

const HIGHLIGHTS = [
  { icon: Sparkles, title: "Every tool in one place", text: "LinkedIn posts, outreach, client updates, prompts and meeting notes." },
  { icon: History, title: "Nothing gets lost", text: "Everything you write is saved, searchable and ready to copy again." },
  { icon: ShieldCheck, title: "Your work stays yours", text: "Each account sees its own records, and only admins see everything." },
] as const

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

/**
 * The frame both account pages share: the brand side (a violet panel on a wide screen, a slim
 * band on a phone) and the form card beside it.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => (
  <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
    <aside className="relative overflow-hidden bg-gradient-to-br from-on-primary-fixed-variant via-primary to-primary-container text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Soft light behind the copy, and the gold spark of the logo repeated large */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-secondary-container/20 blur-3xl" aria-hidden="true" />

      <div className="relative flex items-center gap-3 px-5 py-5 lg:p-0">
        <Image src={SITE_LOGO_PNG} alt="" width={44} height={44} priority className="h-10 w-10 rounded-xl shadow-lg ring-1 ring-white/30 lg:h-11 lg:w-11" />
        <div>
          <p className="text-lg font-bold leading-tight tracking-tight">{SITE_SHORT_NAME}</p>
          <p className="text-[12px] font-medium text-white/75">{SITE_PURPOSE}</p>
        </div>
      </div>

      <div className="relative hidden max-w-md lg:block">
        <h2 className="text-4xl font-bold leading-[1.15] tracking-tight xl:text-[44px]">
          Write less.
          <br />
          Reach further.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/80">
          The workspace behind every LinkedIn post, outreach message and client update you send.
        </p>
        <ul className="mt-10 flex flex-col gap-5">
          {HIGHLIGHTS.map(({ icon: Icon, title: highlight, text }) => (
            <li key={highlight} className="flex gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{highlight}</span>
                <span className="block text-[13px] leading-snug text-white/75">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative hidden text-[12px] text-white/60 lg:block">Signed-in access only. Your session stays private to this browser.</p>
    </aside>

    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-outline-variant/80 bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">{title}</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </main>
  </div>
)
