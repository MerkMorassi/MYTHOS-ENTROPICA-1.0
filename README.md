# MYTHOS-ENTROPICA-1.0

**MYTHOS VAULT / NOESIS — Browser-Local Semantic Archive**

MYTHOS VAULT / NOESIS is a deliberately small, browser-local RAG application for building and querying a bounded semantic archive. Source material is ingested, deterministically chunked, embedded through Gemini, persisted in IndexedDB, retrieved through hybrid semantic/lexical matching, and supplied to a bounded generation step.

The application is designed around a simple UNIX-style separation of concerns: the UI remains lightweight, persistence is isolated, Gemini network access is isolated, and logical record compatibility is kept separate from the physical IndexedDB schema.

## Current Application

The current application is a vanilla browser application using native JavaScript modules, browser APIs, Tailwind CDN utilities, and the preserved MythOS Vault stylesheet.

### Current Architecture

```text
CANONICAL UI
    │
    ▼
ENTROPICA CONTROLLER / RAG ENGINE
    │
    ├── DATABASE BOUNDARY
    │       ├── database.js
    │       ├── database-schema.js
    │       └── database-compat.js
    │
    └── GEMINI API BOUNDARY
            └── gemini-api.js
```

### Repository Layout

```text
MYTHOS-ENTROPICA-1.0/
├── index.html
├── LICENSE
├── README.md
├── css/
│   └── mythos-vault.css
└── js/
    ├── database-compat.js
    ├── database-schema.js
    ├── database.js
    ├── entropica.js
    └── gemini-api.js
```

## Design Principles

* **Canonical UI is authoritative.** Application architecture is refactored around the established MythOS Vault interface rather than redesigning the interface during architectural work.
* **CSS is frozen.** `css/mythos-vault.css` is the authoritative application stylesheet and is not replaced by generated or competing styling.
* **No inline JavaScript.** Application behavior lives in external ES modules.
* **Single Gemini boundary.** `gemini-api.js` owns Gemini network requests.
* **Single database boundary.** `database.js` owns IndexedDB access.
* **Logical schema is independent of physical storage.** `database-schema.js` and `database-compat.js` normalize records without requiring an IndexedDB version increase for ordinary logical changes.
* **No destructive corpus reset.** Existing vectors and LOREPACK material are preserved during application refactoring.
* **Small modules.** Each module has one clear responsibility; obsolete compatibility layers and duplicate implementations are removed rather than accumulated.
* **Browser-local by design.** Corpus data remains in the user's browser IndexedDB rather than being sent to a separate application database.

## Persistence

The physical IndexedDB database is:

```text
Database: mythos_rag_db
Version: 6

Stores:
  - vectors
  - documents
  - logs
```

The native IndexedDB version is intentionally held at **6**.

Logical record evolution is handled by the schema and compatibility modules rather than by creating a version ladder for every application change.

Application settings such as the Gemini API key, persona/system instruction, glossary, and selected model are stored separately in browser `localStorage`. The application does not depend on a legacy `settings` object store.

Existing vector data must not be cleared as part of normal application updates.

## Gemini API

Gemini access is isolated in `js/gemini-api.js`.

### Current Model Contract

* **Generation:** `gemini-3.7-flash`
* **Embeddings:** `gemini-embedding-001`

The application does not use obsolete model identifiers such as:

* `text-embedding-004`
* `gemini-flash-latest`
* `gemini-2.5-flash`
* `gemini-3.0-pro`
* `gemini-1.5-pro`

The Gemini API key is supplied at runtime and is not part of the source repository.

## RAG Behavior

The Entropica engine provides a bounded retrieval pipeline:

1. Source material is loaded from supported local inputs.
2. Text is normalized and divided into deterministic overlapping chunks.
3. Chunks are embedded using `gemini-embedding-001` when embeddings are not already present.
4. Vector records are persisted to IndexedDB.
5. Query text is embedded through the same embedding boundary.
6. Retrieval combines semantic vector similarity with lexical relevance.
7. A bounded set of retrieved records is supplied to Gemini as context.
8. The generation step is instructed to remain grounded in retrieved archive material.

### Default Retrieval Parameters

* **Chunk size:** 1800 characters
* **Chunk overlap:** 250 characters
* **Result limit:** 8
* **Semantic weighting:** 75%
* **Lexical weighting:** 25%

Vectors are treated as belonging to a specific embedding space. Retrieval should only use compatible vectors rather than silently mixing incompatible embedding models or dimensions.

## LOREPACK

The application supports LOREPACK archive import/export for preserving and moving corpus material.

The logical compatibility layer accepts common legacy/current field forms, including:

* Text: `text`, `content`, or `chunk`
* Embeddings: `embedding` or `vector`
* Metadata: normalized into a dedicated `metadata` object
* Identifiers: existing `id` / `key` values or generated UUIDs

This compatibility behavior exists to protect existing archive material while allowing the application schema to remain clean.

## Runtime Requirements

The application requires:

* A modern browser with ES module support
* IndexedDB
* Network access to the Gemini API for embedding and generation operations
* A valid Gemini API key supplied at runtime

Because the application is browser-local, no Node.js runtime or application server is required for the core Vault experience.

## Security and Data Handling

* API keys are runtime configuration and must never be committed to source control.
* Corpus records are stored locally in the browser's IndexedDB database.
* Refactoring must not perform destructive vector/database resets.
* Gemini receives only the material required for the requested embedding or bounded generation operation.

## Development Discipline

This repository is the working application, not a disposable mockup. Changes should preserve the existing archive and the canonical UI while improving implementation quality underneath it.

When modifying the application:

1. Preserve the canonical HTML structure and visual design.
2. Preserve `css/mythos-vault.css` unless an explicit UI change is authorized.
3. Keep Gemini calls inside `gemini-api.js`.
4. Keep IndexedDB calls inside `database.js`.
5. Keep schema normalization inside `database-schema.js` / `database-compat.js`.
6. Keep application orchestration inside `entropica.js`.
7. Do not introduce duplicate database or RAG implementations.
8. Do not increment the physical IndexedDB version for logical schema changes.
9. Do not clear or rebuild the corpus merely to accommodate code changes.
10. Verify the repository for obsolete names, duplicate files, stale model IDs, and accidental inline code after structural changes.

## Status

**MYTHOS VAULT / NOESIS — current browser-local Entropica application under architectural reconciliation.**

The repository preserves the working semantic archive architecture while separating UI, RAG orchestration, persistence, logical schema compatibility, and Gemini network access into explicit modules.
