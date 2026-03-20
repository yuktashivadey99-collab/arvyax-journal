# Architecture Document — ArvyaX Journal

## System Overview

```
┌─────────────────┐     HTTP/SSE      ┌──────────────────────┐
│   React SPA     │ ─────────────────▶│  Express API Server  │
│  (Nginx:80)     │ ◀─────────────────│     (Node:4000)      │
└─────────────────┘                   └──────────┬───────────┘
                                                  │
                               ┌──────────────────┼────────────────────┐
                               │                  │                    │
                        ┌──────▼──────┐   ┌───────▼──────┐   ┌───────▼───────┐
                        │  SQLite DB  │   │ Analysis     │   │  Anthropic    │
                        │  (journal)  │   │ Cache Table  │   │  Claude API   │
                        └─────────────┘   └──────────────┘   └───────────────┘
```

## Data Model

### `journal_entries`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID v4 |
| user_id | TEXT | Indexed |
| ambience | TEXT | Enum-constrained |
| text | TEXT | Raw journal entry |
| emotion | TEXT | Nullable until analyzed |
| keywords | TEXT | JSON array string |
| summary | TEXT | LLM-generated |
| analyzed_at | TEXT | ISO datetime |
| created_at | TEXT | Auto-set |

### `analysis_cache`
| Column | Type | Notes |
|---|---|---|
| text_hash | TEXT PK | SHA-256 of lowercased text |
| emotion | TEXT | |
| keywords | TEXT | JSON array |
| summary | TEXT | |
| created_at | TEXT | |

---

## Q1: How would you scale this to 100,000 users?

### Database Layer
- **Migrate from SQLite → PostgreSQL**: SQLite's WAL mode handles concurrent reads well but write throughput is limited. PostgreSQL supports full concurrent writes, connection pooling, and horizontal read replicas.
- **Connection pooling**: Use PgBouncer or `pg-pool` to manage DB connections (SQLite doesn't have this problem, but Postgres needs it at scale).
- **Read replicas**: Route all `GET` queries to replicas and `POST/UPDATE` to the primary. This is especially useful for insights queries which are aggregation-heavy.
- **Partition journal_entries by user_id or date range** to keep query plans efficient.

### API Layer
- **Horizontal scaling**: The Express server is stateless (no in-process sessions). At scale, run multiple instances behind a load balancer (e.g. AWS ALB, nginx upstream).
- **Use PM2 cluster mode** or Kubernetes pods, allowing the API to use all CPU cores.
- **CDN for frontend**: Serve the React build from S3 + CloudFront (or Vercel/Netlify). Zero origin load for static assets.

### Queue for LLM calls
- At scale, LLM calls cannot be made synchronously in the HTTP request lifecycle. Introduce a **job queue** (BullMQ + Redis) where each analyze request pushes a job, and workers consume it. The client polls for results or uses WebSockets.

### Infrastructure
```
Users → CloudFront CDN → S3 (React)
Users → ALB → API Instances (x3+) → PostgreSQL Primary
                                   → PostgreSQL Replicas (read)
                                   → Redis (cache + queue)
                                   → BullMQ Workers → Anthropic API
```

---

## Q2: How would you reduce LLM cost?

### 1. Caching (already implemented)
The current system uses SHA-256 content hashing. Identical or duplicate texts (same journal entry analyzed twice, batch retries) never hit the API. **Estimated savings: 30–40%** for a journal product where users occasionally re-analyze.

### 2. Batch analysis
Instead of analyzing one entry at a time, use **Anthropic's Batch API** to send multiple entries together at 50% cost discount. Schedule a nightly batch job for all unanalyzed entries.

### 3. Prompt optimization
The current system prompt is ~100 tokens. Keep it tight — every token in the system prompt is charged on every call.

### 4. Use a smaller model for simple entries
Implement a **tiered routing strategy**:
- Short entries (< 50 words): use `claude-haiku` (10x cheaper)
- Long or complex entries: use `claude-sonnet`
- Detect text complexity score before routing

### 5. Client-side pre-filtering
Skip analysis for entries with fewer than 20 meaningful words (very short notes like "good session" don't need LLM analysis — rule-based keyword matching suffices).

### 6. Semantic similarity cache
Hash-based cache only catches identical text. A **vector similarity cache** (using embeddings + pgvector or Pinecone) can catch near-duplicate entries within a configurable cosine distance threshold, dramatically expanding cache hit rate.

---

## Q3: How would you cache repeated analysis?

### Current implementation (DB-level)
```
text → SHA-256 → lookup in analysis_cache table → hit? return | miss? call LLM + store
```

This is **persistent across server restarts** and shared across all instances (if using Postgres).

### Enhanced multi-layer caching strategy

**Layer 1: In-process memory cache (node-cache)**
- TTL: 5 minutes
- Capacity: ~500 entries
- Zero latency for hot entries (re-analyzed in same session)

**Layer 2: Redis distributed cache**
- TTL: 30 days
- Shared across all API instances
- Eliminates duplicate LLM calls cluster-wide
- Use `SETNX` (set if not exists) for atomic cache population

**Layer 3: DB persistence (current)**
- Permanent storage, never expires
- Fallback when Redis is unavailable

**Cache key strategy:**
```js
// Normalize text before hashing to maximize cache hit rate
const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
const key = sha256(normalized);
```

**Cache invalidation:** Analysis results for journal entries are essentially immutable (the text doesn't change). No invalidation needed — TTLs are for memory management only, not correctness.

---

## Q4: How would you protect sensitive journal data?

Journal entries are deeply personal mental health data. Protection must be multi-layered.

### 1. Encryption at rest
- **Application-level encryption**: Encrypt the `text` column using AES-256-GCM before storing. Keep the key in a secrets manager (AWS KMS, HashiCorp Vault), not in the .env file.
- Enable **SQLite encryption** via SQLCipher (or use PostgreSQL with pgcrypto).

```js
// Example: encrypt before INSERT
const encrypted = aes256gcm.encrypt(process.env.FIELD_KEY, entry.text);
db.prepare("INSERT INTO journal_entries (text, ...) VALUES (?, ...)").run(encrypted, ...);
```

### 2. Transport security
- **HTTPS only** in production (TLS 1.2+). Use Certbot + Let's Encrypt or AWS ACM.
- Strict CORS policy — only allow known frontend origins.
- HSTS headers to prevent protocol downgrade.

### 3. Authentication & Authorization
- **Never trust userId from request body** in production. Use JWT or session tokens.
- Validate that the authenticated user owns the entry before any read/write operation.
- Implement row-level security in PostgreSQL (at scale).

### 4. Input sanitization
- Validate and strip HTML/script injection from journal text.
- Cap maximum text length (prevent prompt injection via large inputs to LLM).
- Rate limiting per user, not just per IP (authenticated rate limits).

### 5. LLM data privacy
- The current implementation sends raw journal text to Anthropic's API. At scale:
  - Review Anthropic's data processing agreement (DPA) for enterprise compliance.
  - Consider **on-premise or private LLM deployment** (Ollama + Llama 3 or Mistral) if strict GDPR/HIPAA compliance is needed.
  - Strip or pseudonymize PII (names, locations) before sending to external APIs.

### 6. Audit & Compliance
- Log all access to journal entries (who read what, when).
- Implement **data retention policies** — users can request deletion (GDPR right to erasure).
- Separate the encryption key from the data — compromise of the DB doesn't expose plaintext.

### 7. Database hardening
- Never expose the database port publicly (use private VPC/subnet).
- Use a **dedicated read-only DB user** for the insights/GET routes.
- Regular automated backups with encryption.

---

## Current Limitations & Production TODOs

| Item | Current | Production |
|---|---|---|
| Auth | userId from body | JWT/OAuth |
| DB | SQLite | PostgreSQL |
| Cache | DB-only | Redis + DB |
| LLM calls | Sync in request | BullMQ async queue |
| Encryption | None | AES-256-GCM |
| Observability | console.log | OpenTelemetry + Datadog |
| Testing | Manual | Jest + Supertest |
