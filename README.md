# MYTHOS-ENTROPICA-1.0

**ENTROPICA 1.0 — Bounded RAG / Browser-Local Semantic Archive**

ENTROPICA is a deliberately small TypeScript/Vite prototype for building a bounded semantic archive in the browser. Source material is ingested, deterministically chunked, embedded, persisted in IndexedDB, retrieved by cosine similarity, and supplied to a bounded generation step that is instructed to answer only from retrieved corpus material.

## 1.0 Baseline

The authoritative development baseline for this repository is the preserved `MYTHOS-ENTROPICA-1.0.zip` artifact. It contains the TypeScript/Vite application, benchmark contract, and browser-local persistence/RAG implementation.

**Baseline properties:**

- TypeScript + Vite + native browser APIs
- Browser-local IndexedDB corpus
- Deterministic text chunking
- LOREPACK JSON import/export
- Gemini embeddings using `gemini-embedding-001`
- Bounded cosine-similarity retrieval
- Gemini generation using `gemini-3.6-flash`
- Embedding-model metadata retained with vectors
- Incompatible embedding spaces excluded from retrieval
- Runtime API key held in `sessionStorage`; no API keys belong in source control
- No Aether dependency
- 1.0 treated as a benchmark artifact rather than a moving target

## Architecture

```text
SOURCE MATERIAL
      │
      ▼
 INGEST / IMPORT
      │
      ▼
 CHUNK / NORMALIZE
      │
      ▼
     EMBED
      │
      ▼
 INDEXEDDB CORPUS
      │
      ▼
 SEMANTIC RETRIEVAL
      │
      ▼
 BOUNDED CONTEXT
      │
      ▼
 GEMINI GENERATION
      │
      ▼
 ANSWER + SOURCE IDS
```

The retrieval layer selects compatible vectors and constructs the bounded context; the generation layer is instructed not to use outside knowledge.

## Repository layout

```text
MYTHOS-ENTROPICA-1.0/
├── benchmark/
│   └── benchmark.json       # 1.0 benchmark contract
├── public/
│   └── .gitkeep
├── src/
│   ├── db.ts                # IndexedDB persistence and corpus stats
│   ├── gemini.ts            # Gemini embedding/generation API boundary
│   ├── lorepack.ts          # LOREPACK normalization, chunking, export
│   ├── main.ts              # Browser application/UI
│   ├── rag.ts               # Retrieval and bounded-RAG orchestration
│   ├── styles.css           # Application styling
│   └── types.ts             # Core data contracts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Run locally

Requirements: a current Node.js installation and a Gemini API key.

```bash
npm install
npm run check
npm run build
npm run dev
```

Open the Vite development URL, enter the Gemini API key for the current browser session, then ingest TXT or LOREPACK JSON material.

## LOREPACK

The importer accepts either a root array or common containers such as:

- `records`
- `chunks`
- `documents`
- `items`
- `entries`

Text can be supplied under `text`, `content`, `body`, or `chunk`. Existing vectors can be supplied under `embedding`, `vector`, or `values`.

The application can export the current corpus as a versioned `LOREPACK` JSON artifact.

## Retrieval contract

Default retrieval parameters:

- **Top K:** 8
- **Minimum similarity:** 0.20
- **Embedding model:** `gemini-embedding-001`

Only records whose vector dimensionality matches the query vector and whose embedding model matches the active embedding model are eligible for retrieval.

## Persistence contract

The corpus is stored in browser IndexedDB under the `ENTROPICA_1_0` database. The implementation preserves the existing database version and only performs a schema upgrade when required stores are missing; it does not downgrade an existing database.

## Benchmark discipline

`benchmark/benchmark.json` defines the 1.0 contract. Do not silently mutate the 1.0 benchmark while experimenting with later revisions. New architectural or experimental work should be versioned explicitly.

The current 1.0 baseline is intentionally small. Hardening, expanded compiler architecture, alternate storage adapters, and future Entropica revisions belong in subsequent versions or clearly identified experimental branches.

## Status

**ENTROPICA 1.0 — baseline established.**

This repository is the canonical GitHub home for the project. The preserved ZIP artifact is the source baseline for reconstruction and reconciliation of the application code when required.
