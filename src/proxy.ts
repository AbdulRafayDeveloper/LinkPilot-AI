import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/config/env"
import { SESSION_COOKIE, readSession } from "@/lib/sessionToken"
import { AUTH_MESSAGES, AUTH_REQUIRED_HEADER, HOME_PATH, LOGIN_PATH, REQUEST_PATH_HEADER, SIGNUP_PATH } from "@/constants/auth"
import { PUBLIC_PLAN_ENDPOINT, PUBLIC_PLAN_PATH } from "@/constants/employees"
import { PUBLIC_PROJECT_ENDPOINT, PUBLIC_PROJECT_PATH } from "@/constants/clientProjectTasks"
import { CRON_BACKUP_PATH } from "@/constants/backups"

/**
 * The sign-in gate in front of every page and API route. It checks only that the session cookie is
 * validly signed and unexpired (no database), which is enough to send a signed-out visitor to the
 * sign-in page. It is not the authorization: every API route loads the account itself
 * (requireViewer), so a deleted account or an ended session is refused there.
 */

// Reachable signed out: the two account pages and the calls they make
const PUBLIC_PAGES = new Set([LOGIN_PATH, SIGNUP_PATH])
const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/signup", "/api/auth/logout"])
// A link whose signed token in the address is the key, checked by the route it opens: an employee's
// own daily plan, and a client project shared read only
const PUBLIC_LINK_PREFIXES = [PUBLIC_PLAN_PATH, PUBLIC_PLAN_ENDPOINT, PUBLIC_PROJECT_PATH, PUBLIC_PROJECT_ENDPOINT]
const isPlanLink = (pathname: string) => PUBLIC_LINK_PREFIXES.some((prefix) => pathname.startsWith(`${prefix}/`))
// The weekly database backup: nobody is signed in for it, so the route checks CRON_SECRET itself
const isScheduledJob = (pathname: string) => pathname === CRON_BACKUP_PATH

// Only a path inside the app, so ?next= can't send someone to another site after signing in; nowhere
// to go back to is the home page itself, never "/" (a browser may still hold the root's old permanent redirect)
const safeNext = (path: string) => (path !== "/" && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : HOME_PATH)

/**
 * Carries the path the request came in on, so `requireViewer` can tell which tool a route belongs
 * to without every route having to name itself. It is set here and nowhere else; a header that
 * arrived from outside is replaced rather than trusted.
 */
function withPath(request: NextRequest, pathname: string) {
  const headers = new Headers(request.headers)
  headers.set(REQUEST_PATH_HEADER, pathname)
  return NextResponse.next({ request: { headers } })
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const signedIn = readSession(request.cookies.get(SESSION_COOKIE)?.value, env.AUTH_SECRET) !== null

  if (PUBLIC_PAGES.has(pathname)) {
    // Someone already signed in has nothing to do on the sign-in page
    if (!signedIn) return withPath(request, pathname)
    return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next") ?? HOME_PATH), request.url))
  }
  if (PUBLIC_API.has(pathname) || isPlanLink(pathname) || isScheduledJob(pathname) || signedIn) return withPath(request, pathname)

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json({ success: false, message: AUTH_MESSAGES.signInRequired }, { status: 401 })
    response.headers.set(AUTH_REQUIRED_HEADER, "required")
    return response
  }
  const login = new URL(LOGIN_PATH, request.url)
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except Next's own files, the social cards, the public brand files (icons, manifest, robots,
  // sitemap) and the offline screen with its service worker, which must load as themselves even signed out:
  // a sign-in redirect cached as the offline page would be what an offline user saw
  matcher: ["/((?!_next/|og/|favicon|icon-|apple-touch-icon|maskable-icon|monochrome-icon|safari-pinned-tab|linkpilot-mark|manifest|site\\.webmanifest|robots\\.txt|sitemap\\.xml|sw\\.js|offline\\.html).*)"],
}
