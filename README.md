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

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

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

---

## 📡 API Reference

### `POST /api/journal`
Create a journal entry.

**Request:**
```json
{
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

**Response:** `201 Created`
```json
{
  "message": "Journal entry created successfully",
  "entry": {
    "id": "uuid",
    "userId": "123",
    "ambience": "forest",
    "text": "...",
    "emotion": null,
    "createdAt": "2024-01-15T10:00:00"
  }
}
```

---

### `GET /api/journal/:userId`
Get all entries for a user.

**Query params:** `?limit=20&offset=0&ambience=forest`

**Response:** `200 OK`
```json
{
  "total": 8,
  "entries": [...]
}
```

---

### `POST /api/journal/analyze`
Analyze text with LLM (standalone, no storage).

**Request:**
```json
{ "text": "I felt calm today after listening to the rain" }
```

**Response:**
```json
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "User experienced relaxation during the forest session",
  "cached": false
}
```

**Streaming:** Add `"stream": true` to get SSE response.

---

### `POST /api/journal/:entryId/analyze`
Analyze a stored entry and persist results.

---

### `GET /api/journal/insights/:userId`
Get aggregated insights.

**Response:**
```json
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain"],
  "emotionBreakdown": { "calm": 5, "joyful": 2, "reflective": 1 },
  "ambienceBreakdown": { "forest": 4, "ocean": 3, "mountain": 1 },
  "streak": 3
}
```

---

## 🏗️ Project Structure

```
arvyax-journal/
├── backend/
│   ├── db/
│   │   └── database.js        # SQLite schema + connection
│   ├── middleware/
│   │   └── llmService.js      # Anthropic API + caching + streaming
│   ├── routes/
│   │   └── journal.js         # All journal endpoints
│   ├── server.js              # Express app + rate limiting
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/journal.js     # API client helpers
│   │   ├── App.js             # Main React component
│   │   └── App.css            # Nature-themed styles
│   ├── public/index.html
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md
```

---

## 🧪 Test the API

```bash
# Create entry
curl -X POST http://localhost:4000/api/journal \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","ambience":"forest","text":"Felt very peaceful watching the rain fall through the canopy."}'

# Analyze text
curl -X POST http://localhost:4000/api/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"I felt calm and grounded walking through the forest."}'

# Get insights
curl http://localhost:4000/api/journal/insights/u1
```

---

## 🔑 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Your Anthropic API key |
| `PORT` | ❌ | 4000 | Backend port |
| `FRONTEND_URL` | ❌ | http://localhost:3000 | CORS origin |
| `NODE_ENV` | ❌ | development | Environment |

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3)
- **LLM:** Anthropic Claude Sonnet
- **Frontend:** React 18
- **Containerization:** Docker + Nginx
