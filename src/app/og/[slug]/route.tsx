import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"
import { SITE_URL } from "@/config/env"
import { SITE_SHORT_NAME } from "@/config/site"
import { HOME_SEO, SEO_PAGES, getSeoPage } from "@/constants/seo"

/**
 * GET /og/<page>.png: the 1200×630 social preview card for one page (Open Graph and X cards):
 * the brand mark and name, the page's name and what it does, and the site's address, on the
 * brand gradient. Everything sits in the centre so WhatsApp's square crop keeps the logo and
 * the title. Built once at build time; an unknown page gets the home card, and if rendering
 * ever fails the official logo is returned instead, so a share never shows a broken image.
 */
export const dynamic = "force-static"

const WIDTH = 1200
const HEIGHT = 630
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
// Fixed paths, so the build traces exactly these files into the route (next.config.ts ships them)
// The 256px render of the mark is plenty for a 120px logo and keeps the card small
const MARK = path.join(process.cwd(), "public", "icon-256x256.png")
const FONT_SEMIBOLD = path.join(process.cwd(), "src", "assets", "fonts", "Inter-600.ttf")
const FONT_BOLD = path.join(process.cwd(), "src", "assets", "fonts", "Inter-700.ttf")

export function generateStaticParams() {
  return SEO_PAGES.map((page) => ({ slug: `${page.slug}.png` }))
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params
  const page = getSeoPage(slug.replace(/\.png$/, "")) ?? HOME_SEO

  try {
    const [mark, semibold, bold] = await Promise.all([readFile(MARK), readFile(FONT_SEMIBOLD), readFile(FONT_BOLD)])
    const host = new URL(SITE_URL).host

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            fontFamily: "Inter",
            color: "#ffffff",
            // The brand gradient with soft light from the top left, like the sheen on the mark
            backgroundImage:
              "radial-gradient(circle at 16% 10%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%), linear-gradient(135deg, #7c3aed 0%, #5b21b6 52%, #2e1065 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
            <img src={`data:image/png;base64,${mark.toString("base64")}`} width={88} height={88} alt="" />
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{SITE_SHORT_NAME}</div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 700,
                color: "#451a03",
                backgroundColor: "#fbbf24",
                borderRadius: 10,
                padding: "5px 12px",
              }}
            >
              AI
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 46,
              maxWidth: 1000,
              textAlign: "center",
              fontSize: page.heading.length > 22 ? 64 : 76,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.08,
            }}
          >
            {page.heading}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              maxWidth: 900,
              textAlign: "center",
              fontSize: 30,
              fontWeight: 600,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.3,
            }}
          >
            {page.subheading}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 40,
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              color: "rgba(255,255,255,0.72)",
              letterSpacing: 0.5,
            }}
          >
            {host}
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          { name: "Inter", data: semibold, weight: 600, style: "normal" },
          { name: "Inter", data: bold, weight: 700, style: "normal" },
        ],
        headers: { "Cache-Control": CACHE_CONTROL },
      }
    )
  } catch (error: unknown) {
    console.error("OG image render failed; serving the logo instead:", error instanceof Error ? error.message : error)
    return new Response(new Uint8Array(await readFile(MARK)), {
      headers: { "Content-Type": "image/png", "Cache-Control": CACHE_CONTROL },
    })
  }
}
