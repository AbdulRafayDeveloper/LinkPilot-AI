import test from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import load from "./load.mjs"

const { fetchWithRetry } = load("lib/apiClient.ts")
const { IDEMPOTENCY_HEADER, IDEMPOTENCY_KEY_PATTERN } = load("constants/idempotency.ts")

/**
 * A local server that answers each request with the next status in `statuses` (the last one repeats),
 * and remembers the method and Idempotency-Key of every request it got.
 */
async function serve(statuses) {
  const seen = []
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, key: req.headers[IDEMPOTENCY_HEADER.toLowerCase()] ?? null })
    const status = statuses[Math.min(seen.length - 1, statuses.length - 1)]
    // Retry-After: 0 keeps the test fast; the client honours it instead of backing off
    res.writeHead(status, { "Content-Type": "application/json", "Retry-After": "0" })
    res.end(JSON.stringify({ success: status < 400, data: { ok: true } }))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  return { url: `http://127.0.0.1:${port}/`, seen, close: () => new Promise((resolve) => server.close(resolve)) }
}

test("an idempotent POST is retried after a 503 and sends the same key every time", async () => {
  const server = await serve([503, 200])
  try {
    const response = await fetchWithRetry(server.url, { method: "POST", body: "{}" }, { idempotent: true })
    assert.equal(response.status, 200)
    assert.equal(server.seen.length, 2)
    assert.ok(IDEMPOTENCY_KEY_PATTERN.test(server.seen[0].key), `key looks random: ${server.seen[0].key}`)
    assert.equal(server.seen[1].key, server.seen[0].key)
  } finally {
    await server.close()
  }
})

test("two separate idempotent calls get different keys", async () => {
  const server = await serve([200])
  try {
    await fetchWithRetry(server.url, { method: "POST" }, { idempotent: true })
    await fetchWithRetry(server.url, { method: "POST" }, { idempotent: true })
    assert.notEqual(server.seen[0].key, server.seen[1].key)
  } finally {
    await server.close()
  }
})

test("a plain POST is not retried and carries no key", async () => {
  const server = await serve([503, 200])
  try {
    const response = await fetchWithRetry(server.url, { method: "POST" })
    assert.equal(response.status, 503)
    assert.equal(server.seen.length, 1)
    assert.equal(server.seen[0].key, null)
  } finally {
    await server.close()
  }
})

test("a POST marked retry is retried, still without a key", async () => {
  const server = await serve([502, 200])
  try {
    const response = await fetchWithRetry(server.url, { method: "POST" }, { retry: true })
    assert.equal(response.status, 200)
    assert.equal(server.seen.length, 2)
    assert.equal(server.seen[1].key, null)
  } finally {
    await server.close()
  }
})

test("a GET is retried on its own, and a 500 or a 400 is never retried", async () => {
  const flaky = await serve([504, 200])
  const broken = await serve([500])
  const refused = await serve([400])
  try {
    assert.equal((await fetchWithRetry(flaky.url)).status, 200)
    assert.equal(flaky.seen.length, 2)
    assert.equal((await fetchWithRetry(broken.url, { method: "POST" }, { idempotent: true })).status, 500)
    assert.equal(broken.seen.length, 1)
    assert.equal((await fetchWithRetry(refused.url, { method: "POST" }, { idempotent: true })).status, 400)
    assert.equal(refused.seen.length, 1)
  } finally {
    await Promise.all([flaky.close(), broken.close(), refused.close()])
  }
})

test("an idempotent POST that keeps failing stops after its retries and returns the last answer", async () => {
  const server = await serve([503])
  try {
    const response = await fetchWithRetry(server.url, { method: "POST" }, { idempotent: true })
    assert.equal(response.status, 503)
    assert.equal(server.seen.length, 3)
    assert.equal(new Set(server.seen.map((request) => request.key)).size, 1)
  } finally {
    await server.close()
  }
})
