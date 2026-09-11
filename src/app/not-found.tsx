"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { SITE_NAME } from "@/config/site"

export default function NotFound() {
  return (
    <div className="font-body-md bg-[#FAF7F2] text-on-surface flex flex-col items-center justify-center p-4 min-h-screen max-h-screen h-screen overflow-hidden w-screen select-none">
      {/* Brand Header Banner */}
      <div className="flex items-center gap-3 mb-8">
        <Image
          alt={`${SITE_NAME} Logo`}
          className="w-10 h-10 object-contain"
          src="/logo.png"
          width={40}
          height={40}
          priority
        />
        <div className="text-left">
          <h2 className="font-headline-md text-base font-extrabold text-primary leading-tight">LinkPilot</h2>
          <p className="font-label-sm text-[10px] text-outline uppercase tracking-wider">AI</p>
        </div>
      </div>

      {/* Main 404 Card */}
      <div className="bg-white border border-outline-variant p-8 md:p-12 rounded-2xl max-w-md w-full text-center shadow-lg space-y-6">
        {/* Glow Logo Container */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surface-container-low border border-outline-variant p-4 shadow-sm relative">
          <Image
            alt={`${SITE_NAME} Brand Logo`}
            className="w-full h-full object-contain"
            src="/logo.png"
            width={64}
            height={64}
            priority
          />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold text-primary font-mono tracking-wider">404</h1>
          <h2 className="text-lg font-bold text-on-surface">Page Not Found</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            The resource you requested could not be located on the server. Let&apos;s get you back to your LinkedIn tools.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-[#004a44] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 duration-150 w-full"
          >
            <ArrowLeft size={16} />
            <span>Back to {SITE_NAME}</span>
          </Link>
        </div>
      </div>

      {/* Footer Branding Subline */}
      <p className="mt-12 text-[11px] text-outline-variant uppercase tracking-widest font-semibold">
        {SITE_NAME} © {new Date().getFullYear()}
      </p>
    </div>
  )
}
