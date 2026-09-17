/**
 * A readable browser, operating system and device from a User-Agent header, without a library.
 * It only needs to be right for the browsers people actually sign in with; anything it can't place
 * reads as "Unknown" rather than a guess.
 */

export interface DeviceInfo {
  browser: string
  os: string
  device: "Desktop" | "Mobile" | "Tablet" | "Automated" | "Unknown"
}

// Order matters: Edge and Opera also say Chrome, Chrome also says Safari
const BROWSERS: [RegExp, string][] = [
  [/HeadlessChrome\/(\d+)/, "Headless Chrome"],
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/FxiOS\/(\d+)/, "Firefox"],
  [/CriOS\/(\d+)/, "Chrome"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, "Safari"],
]

const SYSTEMS: [RegExp, string][] = [
  [/Windows NT 10/, "Windows"],
  [/Windows NT/, "Windows"],
  [/iPad/, "iPadOS"],
  [/iPhone|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
]

const AUTOMATED = /bot|crawl|spider|slurp|curl|wget|python-requests|axios|node-fetch|undici|headless/i

export function describeUserAgent(userAgent: string | null): DeviceInfo {
  const ua = userAgent ?? ""
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" }

  const browserMatch = BROWSERS.find(([pattern]) => pattern.test(ua))
  const version = browserMatch ? ua.match(browserMatch[0])?.[1] : null
  const browser = browserMatch ? `${browserMatch[1]}${version ? ` ${version}` : ""}` : "Unknown"
  const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Unknown"

  let device: DeviceInfo["device"] = "Desktop"
  if (AUTOMATED.test(ua)) device = "Automated"
  else if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = "Tablet"
  else if (/Mobile|iPhone|iPod/.test(ua)) device = "Mobile"
  else if (!browserMatch && os === "Unknown") device = "Unknown"

  return { browser, os, device }
}
