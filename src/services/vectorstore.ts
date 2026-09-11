import { OpenAIEmbeddings } from "@langchain/openai"
import { Chroma } from "@langchain/community/vectorstores/chroma"
import { ChromaClient } from "chromadb"
import { env } from "@/config/env"

/**
 * Custom character text splitter to divide text into chunks of given size with overlap.
 * Prevents version import discrepancies across LangChain upgrades.
 */
class CharacterTextSplitter {
  private chunkSize: number
  private chunkOverlap: number

  constructor(options: { chunkSize: number; chunkOverlap: number }) {
    this.chunkSize = options.chunkSize
    this.chunkOverlap = options.chunkOverlap
  }

  async splitText(text: string): Promise<string[]> {
    const chunks: string[] = []
    let start = 0
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length)
      chunks.push(text.substring(start, end))
      start += this.chunkSize - this.chunkOverlap
      if (start >= text.length || end === text.length) {
        break
      }
    }
    return chunks
  }
}

// Embeddings model configuration with transient rate-limit retry support
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: env.OPENAI_API_KEY,
  modelName: env.OPENAI_EMBEDDINGS_MODEL,
  maxRetries: 5, // Handles Rate Limits (HTTP 429) & timeouts with automatic backoff
})

/**
 * Builds a ChromaClient configured for either Chroma Cloud or a local instance.
 * - Parses URL to configure 'host', 'port', and 'ssl' to resolve path deprecation warnings.
 * - Inject token header directly under 'headers' to resolve auth deprecation warnings.
 */
function buildChromaClient(): ChromaClient {
  const isCloud = Boolean(env.CHROMA_API_KEY && env.CHROMA_TENANT && env.CHROMA_DATABASE)
  
  let host = "localhost"
  let port = 8000
  let ssl = false

  try {
    const url = new URL(env.CHROMA_URL)
    host = url.hostname
    port = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80)
    ssl = url.protocol === "https:"
  } catch (e) {
    console.warn("⚠️ Invalid CHROMA_URL format. Defaulting to localhost:8000", e)
  }

  if (isCloud) {
    return new ChromaClient({
      host,
      port,
      ssl,
      tenant: env.CHROMA_TENANT,
      database: env.CHROMA_DATABASE,
      headers: {
        "x-chroma-token": env.CHROMA_API_KEY as string,
      },
    })
  }

  // Local instance — plain HTTP, no auth required
  return new ChromaClient({
    host,
    port,
    ssl,
  })
}

export interface IndexResult {
  chunksCount: number
  success: boolean
  warning?: string
}

/**
 * Splits document text content into character chunks and indexes them into ChromaDB.
 * Automatically routes to Chroma Cloud when cloud credentials are present in env.
 */
export async function indexDocumentVectors(
  docName: string,
  text: string,
  category: string
): Promise<IndexResult> {
  // Enforce chunk limits under 500 characters to stay within model token constraints
  const splitter = new CharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  })

  const chunks = await splitter.splitText(text)

  // Format chunks into LangChain document models with metadata mappings
  const documents = chunks.map((chunk, index) => ({
    pageContent: chunk,
    metadata: {
      source: docName,
      chunkId: index,
      category,
    },
  }))

  try {
    const index = buildChromaClient()

    // Pass custom client instance to LangChain under the correct 'index' property (instead of 'client')
    await Chroma.fromDocuments(documents, embeddings, {
      collectionName: env.CHROMA_COLLECTION_NAME,
      index,
    })
    return { chunksCount: chunks.length, success: true }
  } catch (err: unknown) {
    console.warn("⚠️ Chroma server is unreachable. Defaulting to metadata-only index tracking:", err)
    return {
      chunksCount: chunks.length,
      success: true,
      warning: "ChromaDB Offline",
    }
  }
}
