const TRACKING_PARAM = /^(utm_\w+|ref|ref_src|fbclid|gclid)$/i

/**
 * Normalizes a URL for comparison: http(s) only, no fragment, no tracking parameters,
 * no trailing slash. Returns null for anything that isn't a valid web URL.
 */
export function normalizeUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null

  url.hash = ""
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key)
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1)
  }
  return url.toString()
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
