# Implementation Plan - LinkPilot AI

This document outlines the architectural plan to connect our existing Next.js frontend pages with a robust, production-quality AI and backend infrastructure. All changes will be fully integrated with our active responsive routes.

---

## Phase 1 - Directory Layout & Packages

We will build on our Next.js App Router structure. The backend services, models, and API endpoints will align with the following workspace configuration:

```
src/
  app/
    api/
      chat/             # Chat completion & web search router
      knowledge/        # Document uploads, indexing, & listings
      analytics/        # Operations metrics & API log terminal stream
      inspector/        # LLM execution lifecycle traces
  lib/
    db/                 # MongoDB client instantiation
    vectorstore/        # Vector Database connection pool
  models/
    Document.ts         # Document metadata schema
  services/
    ai.ts               # Model provider factory (OpenAI & Gemini)
    rag.ts              # Embeddings & Vector Search queries
    parser.ts           # Document text extraction (PDF, DOCX, etc.)
```

### Install Packages
- **AI Engine**: `langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/google-genai`
- **Vector Database**: `chromadb`
- **Parsing**: `pdf-parse`, `mammoth`, `cheerio`
- **Validation**: `zod`

---

## Phase 2 - Environment Configurations

The application relies on the following environment variables documented in `.env.example`:

- `MONGODB_URI`: Connection string for persisting document schemas, audit logs, and transaction traces.
- `JWT_SECRET`: Token signature key for session controls.
- `OPENAI_API_KEY`: API access key for GPT model operations.
- `GOOGLE_API_KEY`: API access key for Gemini model operations.
- `LANGCHAIN_TRACING_V2`: Enable LangSmith observability.
- `LANGCHAIN_API_KEY`: LangSmith tracing token.
- `LANGCHAIN_PROJECT`: Target project name ("LinkPilot AI").

---

## Phase 3 - Knowledge Base Integration (`/knowledge-base`)

We will connect the static documents catalog table to dynamic backend API routes:

### Document Listing (GET `/api/knowledge`)
- Queries the MongoDB `Document` collection.
- Returns a list of documents including file name, category, chunk count, status, size, file type, upload date, preview text, and search tags.
- Populates the main document data grid dynamically.

### Document Upload (POST `/api/knowledge/upload`)
- Handles multi-part file uploads (PDF, DOCX, TXT, JSON, MD, CSV).
- Validates file type and size.
- Runs text parsing and splitting via a Recursive Character Text Splitter.
- Generates vector embeddings using OpenAI/Gemini embedding models.
- Populates the database vectors and saves metadata schemas.
- Sends progress states to update the UI upload progress indicator.

### Document Deletion (DELETE `/api/knowledge/:id`)
- Removes the document record from MongoDB.
- Deletes corresponding vectors from the ChromaDB vector database.
- Refreshes the document data table.

---

## Phase 4 - Welcome Workspace & Dynamic Chat (`/`)

We will connect the chat composer and suggestion prompts to the live LLM pipelines:

### Suggestions
- Suggestion prompt clicks automatically feed the composer input, ready for user submission.

### Chat Pipeline (POST `/api/chat`)
- Receives user prompt queries, conversation IDs, and attachment parameters.
- If **Web Search** is activated via the composer three-dots menu dropdown, routes the query through a search tool before feeding context to the LLM.
- Loads the dynamic prompt template from prompt loaders.
- Runs vector search across ChromaDB if context is relevant, retrieving the top 5 chunks.
- Passes retrieved document fragments to the model context.
- Streams generated tokens back to the frontend in real time, rendering answers incrementally.

### Temporary Chat
- If the **Temporary Chat** toggle switch is enabled in the sidebar, prevents conversation logging in database history.

---

## Phase 5 - Analytics Dashboard Integration (`/analytics`)

We will connect the metrics cards, charts, and terminal consoles to dynamic backend parameters:

### KPI Statistics (GET `/api/analytics/kpi`)
- Returns real-time aggregate totals:
  - Total token consumption (input vs. output tokens).
  - Monthly operational cost (calculated based on model token rates).
  - Average request latency (monitored via response timestamps).
  - Active user counts.

### Usage Curves (GET `/api/analytics/trends`)
- Returns historical series arrays mapping:
  - Token consumption over time.
  - Active daily conversation volume.
  - Distribution percentages for active models (GPT-4o vs. Gemini Flash).

### API Logs Console
- Establishes a server-sent events stream returning live API logs (request methods, response statuses, latencies, and token costs) to populate the logs terminal.

---

## Phase 6 - Conversation Inspector (`/inspector`)

We will map trace metrics to the execution lifecycle timeline:

### Trace Details (GET `/api/inspector/:traceId`)
- Returns execution data for a specific conversation request:
  - Timeline execution steps (User Message -> Validation -> Injection Check -> Memory -> RAG Search -> Routing -> Tool Execution -> Complete).
  - Model routing arguments and routing logs.
  - Retrieved context document details (scores, document names, parsed text snippets).
  - Executed tool arguments and command outputs to render in the terminal printout.