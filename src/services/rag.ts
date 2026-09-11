import { OpenAIEmbeddings } from "@langchain/openai"
import { Chroma } from "@langchain/community/vectorstores/chroma"
import { ChromaClient } from "chromadb"
import { env } from "@/config/env"

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: env.OPENAI_API_KEY,
  modelName: env.OPENAI_EMBEDDINGS_MODEL,
  maxRetries: 3,
})

export interface RAGSource {
  source: string
  score: number
  content: string
}

export interface RAGResult {
  contextText: string
  sources: RAGSource[]
}

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

/**
 * Executes a vector similarity search across ChromaDB to retrieve top 5 matching text chunks.
 * Integrates error boundaries returning safe baseline instructions if no documentation matches.
 * Automatically routes to Chroma Cloud when cloud credentials are present in env.
 */
export async function searchRAGContext(query: string): Promise<RAGResult> {
  try {
    const index = buildChromaClient()

    // Pass custom client instance to LangChain under the correct 'index' property (instead of 'client')
    const vectorStore = new Chroma(embeddings, {
      collectionName: env.CHROMA_COLLECTION_NAME,
      index,
    })

    // Retrieve top 5 matched vector items along with L2 distance similarity scores
    const results = await vectorStore.similaritySearchWithScore(query, 5)

    if (!results || results.length === 0) {
      return getEmptyContextResult()
    }

    const sources: RAGSource[] = results.map(([doc, score]) => ({
      source: String(doc.metadata.source || "Unknown Document"),
      score: Number(score),
      content: doc.pageContent,
    }))

    const contextText = results.map(([doc]) => doc.pageContent).join("\n\n---\n\n")

    return { contextText, sources }
  } catch (error: unknown) {
    console.warn("⚠️ RAG Retrieval search failed or Chroma server is offline. Returning default instruction:", error)
    return getEmptyContextResult()
  }
}

/**
 * Returns a fallback result when vector database queries find zero document chunks.
 */
function getEmptyContextResult(): RAGResult {
  return {
    contextText: "NO_CONTEXT_RETRIEVED: No matching company documents were retrieved for this query. The assistant should answer using general knowledge while clearly noting that no relevant internal documentation was found.",
    sources: [],
  }
}
