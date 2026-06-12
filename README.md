# 🌿 ArvyaX Nature Journal

> AI-powered journaling system for immersive nature sessions. Write entries, analyze emotions with LLM, and gain insights about your mental state over time.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Journal Entries** | Create, store, and retrieve entries per user with ambience tagging |
| **LLM Emotion Analysis** | Claude Sonnet-powered analysis returning emotion, keywords, and summary |
| **Insight Dashboard** | Streaks, emotion breakdown, ambience patterns, recent themes |
| **Analysis Cache** | SHA-256 hash-based caching prevents duplicate LLM calls |
| **Streaming Analysis** | Optional SSE streaming for real-time LLM output |
| **Rate Limiting** | Per-IP limits on all routes (10 analyses/min, 100 API calls/15min) |
| **Docker Setup** | One-command deployment with `docker-compose up` |

---

### 1. Clone & Install

```bash
git clone <repo-url>
cd arvyax-journal

# Backend
cd backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm install

# Frontend (in a new terminal)
cd ../frontend
npm install
```

### 2. Run

```bash
# Terminal 1 — Backend
cd backend
npm start
# → API running at http://localhost:4000

# Terminal 2 — Frontend
cd frontend
npm start
# → UI running at http://localhost:3000
```

### 3. Docker (optional)

```bash
# From project root
cp backend/.env.example .env
# Add your ANTHROPIC_API_KEY to .env
docker-compose up --build
```

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3)
- **LLM:** Anthropic Claude Sonnet
- **Frontend:** React 18
- **Containerization:** Docker + Nginx
