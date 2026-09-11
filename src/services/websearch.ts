import * as cheerio from "cheerio"

export interface SearchResult {
  title: string
  snippet: string
  url: string
}

/**
 * Performs a web search query on DuckDuckGo and parses the organic search results.
 */
export async function searchWeb(query: string): Promise<string> {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    })

    if (!response.ok) {
      throw new Error(`DuckDuckGo request failed with status: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    $(".result__body").slice(0, 5).each((_, element) => {
      const title = $(element).find(".result__title").text().trim()
      const snippet = $(element).find(".result__snippet").text().trim()
      const url = $(element).find(".result__url").text().trim()
      if (title && snippet) {
        results.push({ title, snippet, url })
      }
    })

    if (results.length === 0) {
      return "No matching web search results found."
    }

    return results
      .map((r, i) => `[Result #${i + 1}]\nTitle: ${r.title}\nSource: ${r.url}\nSnippet: ${r.snippet}`)
      .join("\n\n")
  } catch (error: any) {
    console.error("Web search execution exception:", error)
    return `Web search failed: ${error.message || String(error)}`
  }
}

/**
 * Scrapes plain text content from a target website URL, purging script and style tags.
 */
export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  })
  if (!response.ok) {
    throw new Error(`ScrapeUrlException: Failed to fetch URL with status ${response.status}`)
  }
  const html = await response.text()
  const $ = cheerio.load(html)
  
  // Remove interactive and script tags
  $("script, style, iframe, noscript, header, footer, nav").remove()
  
  const text = $("body").text().replace(/\s+/g, " ").trim()
  return text || "No readable content found on target webpage."
}

/**
 * Crawls a website starting at startUrl, following same-domain links recursively up to maxPages.
 * Attempts to parse sitemap.xml first for comprehensive URL discovery.
 * Combines all scraped page texts with demarcated header lines.
 */
export async function crawlWebsite(startUrl: string, maxPages = 40): Promise<string> {
  const visited = new Set<string>()
  const queue: string[] = [startUrl]
  const parsedStart = new URL(startUrl)
  const startHostname = parsedStart.hostname.replace("www.", "")

  // 1. Attempt Sitemap URL Discovery
  try {
    const sitemapUrl = `${parsedStart.protocol}//${parsedStart.hostname}/sitemap.xml`
    const sitemapRes = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    })
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text()
      const $ = cheerio.load(xml, { xmlMode: true })
      $("loc").each((_, elem) => {
        const locUrl = $(elem).text().trim()
        if (locUrl) {
          try {
            const parsedLoc = new URL(locUrl)
            const locHostname = parsedLoc.hostname.replace("www.", "")
            if (locHostname === startHostname && !queue.includes(locUrl)) {
              queue.push(locUrl)
            }
          } catch {}
        }
      })
      console.log(`[Crawler] Found ${queue.length - 1} URLs inside sitemap.xml`)
    }
  } catch (e) {
    console.warn("[Crawler] Failed to load sitemap.xml, relying on direct link crawling:", e)
  }

  let combinedText = ""
  let pagesCount = 0

  while (queue.length > 0 && pagesCount < maxPages) {
    const currentUrl = queue.shift()!
    let normalized = currentUrl
    try {
      const parsed = new URL(currentUrl)
      parsed.hash = ""
      normalized = parsed.toString()
    } catch {
      continue
    }

    if (visited.has(normalized)) continue
    visited.add(normalized)

    console.log(`[Crawler] Scraping page ${pagesCount + 1}/${maxPages}: ${normalized}`)

    try {
      const response = await fetch(normalized, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      })
      if (!response.ok) continue

      const html = await response.text()
      const $ = cheerio.load(html)

      // Remove structural boilerplate
      $("script, style, iframe, noscript, header, footer, nav").remove()
      const pageText = $("body").text().replace(/\s+/g, " ").trim()

      if (pageText) {
        combinedText += `\n\n--- START PAGE CONTENT: ${normalized} ---\n${pageText}\n--- END PAGE CONTENT: ${normalized} ---\n\n`
        pagesCount++
      }

      // Collect links to crawl recursively (fallback if sitemap didn't find all)
      $("a[href]").each((_, elem) => {
        const href = $(elem).attr("href")
        if (!href) return

        try {
          const absoluteUrl = new URL(href, normalized)
          const absoluteHostname = absoluteUrl.hostname.replace("www.", "")

          if (absoluteHostname === startHostname && !visited.has(absoluteUrl.toString()) && !queue.includes(absoluteUrl.toString())) {
            queue.push(absoluteUrl.toString())
          }
        } catch {
          // Ignore malformed links
        }
      })
    } catch (err) {
      console.warn(`[Crawler] Failed to crawl URL: ${normalized}`, err)
    }
  }

  return combinedText.trim() || "No readable content found on target website pages."
}
