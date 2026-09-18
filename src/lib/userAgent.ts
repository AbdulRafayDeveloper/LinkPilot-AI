/**
 * A readable browser, operating system and device from a User-Agent header, without a library.
 * It only needs to be right for the browsers people actually sign in with, and for the programs that
 * sign in without one (scripts, command-line tools, API clients), which name themselves; anything it
 * still can't place reads as "Unknown" rather than a guess.
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

/**
 * Programs rather than browsers. Every browser's User-Agent starts with "Mozilla/", and none of these
 * do, so they are only looked for when it doesn't: a script is then shown by its own name and marked
 * Automated, instead of reading as a browser nobody can name. Node's built-in fetch() sends nothing
 * but "node", which is what a test script signing in through the API looks like.
 */
const CLIENTS: [RegExp, string][] = [
  [/^node(?:\/(\d+))?$/i, "Node.js"],
  [/node-fetch\/(\d+)/i, "node-fetch"],
  [/\bundici\b/i, "Node.js"],
  [/axios\/(\d+)/i, "axios"],
  [/curl\/(\d+)/i, "curl"],
  [/Wget\/(\d+)/i, "Wget"],
  [/PowerShell\/(\d+)/i, "PowerShell"],
  [/python-requests\/(\d+)/i, "Python requests"],
  [/python-urllib\/(\d+)/i, "Python urllib"],
  [/aiohttp\/(\d+)/i, "Python aiohttp"],
  [/httpx\/(\d+)/i, "Python httpx"],
  [/PostmanRuntime\/(\d+)/i, "Postman"],
  [/insomnia\/(\d+)/i, "Insomnia"],
  [/Go-http-client\/(\d+)/i, "Go"],
  [/okhttp\/(\d+)/i, "OkHttp"],
  [/Dart\/(\d+)/i, "Dart"],
]

export function describeUserAgent(userAgent: string | null): DeviceInfo {
  const ua = (userAgent ?? "").trim()
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" }

  if (!/^Mozilla\//.test(ua)) {
    const client = CLIENTS.find(([pattern]) => pattern.test(ua))
    if (client) {
      const version = ua.match(client[0])?.[1]
      return { browser: `${client[1]}${version ? ` ${version}` : ""}`, os: "Unknown", device: "Automated" }
    }
  }

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

/**
 * The device as one line: "Chrome 153 on Windows", or just the program when there is no system to
 * name ("Node.js", "curl 8"). Never "Unknown on Unknown": what can't be told is said once.
 */
export function deviceLabel({ browser, os }: Pick<DeviceInfo, "browser" | "os">): string {
  const knownBrowser = Boolean(browser) && browser !== "Unknown"
  const knownOs = Boolean(os) && os !== "Unknown"
  if (knownBrowser && knownOs) return `${browser} on ${os}`
  if (knownBrowser) return browser
  if (knownOs) return `Unknown browser on ${os}`
  return "Unknown device"
}
