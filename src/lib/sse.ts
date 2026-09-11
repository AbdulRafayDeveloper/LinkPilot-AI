const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
}

/**
 * Server side: returns a Server-Sent Events response and gives `run` a `send` function
 * for JSON events. Once the client disconnects, sends are dropped instead of throwing.
 * `run` should catch its own errors and report them as events.
 */
export function createEventStream<T>(run: (send: (event: T) => void) => Promise<void>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: T) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // The client disconnected; nothing left to deliver
        }
      }
      try {
        await run(send)
      } finally {
        try {
          controller.close()
        } catch {
          // Already closed by a client disconnect
        }
      }
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

/**
 * Client side: reads a Server-Sent Events stream and calls onEvent for each parsed `data:` frame.
 * Buffers across network chunks, so events split between chunks are never dropped.
 */
export async function readSSEStream<T>(body: ReadableStream<Uint8Array>, onEvent: (event: T) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n")
      if (data) onEvent(JSON.parse(data) as T)
    }
  }
}
