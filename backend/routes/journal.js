const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { dbRun, dbGet, dbAll } = require("../db/database");
const { analyzeWithCache, analyzeStreaming } = require("../middleware/llmService");

function formatEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    ambience: row.ambience,
    text: row.text,
    emotion: row.emotion ?? null,
    keywords: row.keywords ? JSON.parse(row.keywords) : null,
    summary: row.summary ?? null,
    analyzedAt: row.analyzed_at ?? null,
    createdAt: row.created_at,
  };
}

// POST /api/journal — create entry
router.post("/", async (req, res) => {
  try {
    const { userId, ambience, text } = req.body;
    if (!userId || !ambience || !text)
      return res.status(400).json({ error: "Missing required fields: userId, ambience, text" });

    const validAmbiences = ["forest", "ocean", "mountain", "desert", "meadow"];
    if (!validAmbiences.includes(ambience))
      return res.status(400).json({ error: `ambience must be one of: ${validAmbiences.join(", ")}` });

    if (text.trim().length < 10)
      return res.status(400).json({ error: "text must be at least 10 characters" });

    const id = uuidv4();
    await dbRun(
      "INSERT INTO journal_entries (id, user_id, ambience, text) VALUES (?, ?, ?, ?)",
      [id, userId, ambience, text.trim()]
    );
    const entry = await dbGet("SELECT * FROM journal_entries WHERE id = ?", [id]);
    res.status(201).json({ message: "Journal entry created successfully", entry: formatEntry(entry) });
  } catch (err) {
    console.error("POST /journal error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// GET /api/journal/:userId — get all entries
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, ambience } = req.query;

    let query = "SELECT * FROM journal_entries WHERE user_id = ?";
    const params = [userId];
    if (ambience) { query += " AND ambience = ?"; params.push(ambience); }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const entries = await dbAll(query, params);
    const countRow = await dbGet("SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?", [userId]);
    res.json({ total: countRow.count, entries: entries.map(formatEntry) });
  } catch (err) {
    console.error("GET /journal/:userId error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// POST /api/journal/analyze — standalone LLM analysis
router.post("/analyze", async (req, res) => {
  try {
    const { text, stream } = req.body;
    if (!text || text.trim().length < 5)
      return res.status(400).json({ error: "text is required (min 5 chars)" });

    if (stream) return await analyzeStreaming(text, res);
    const result = await analyzeWithCache(text);
    res.json(result);
  } catch (err) {
    console.error("POST /analyze error:", err);
    res.status(500).json({ error: "LLM analysis failed", detail: err.message });
  }
});

// POST /api/journal/:entryId/analyze — analyze a stored entry
router.post("/:entryId/analyze", async (req, res) => {
  try {
    const { entryId } = req.params;
    const entry = await dbGet("SELECT * FROM journal_entries WHERE id = ?", [entryId]);
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    const result = await analyzeWithCache(entry.text);
    await dbRun(
      "UPDATE journal_entries SET emotion = ?, keywords = ?, summary = ?, analyzed_at = datetime('now') WHERE id = ?",
      [result.emotion, JSON.stringify(result.keywords), result.summary, entryId]
    );
    const updated = await dbGet("SELECT * FROM journal_entries WHERE id = ?", [entryId]);
    res.json({ message: "Analysis complete", entry: formatEntry(updated), cached: result.cached });
  } catch (err) {
    console.error("POST /:entryId/analyze error:", err);
    res.status(500).json({ error: "LLM analysis failed", detail: err.message });
  }
});

// GET /api/journal/insights/:userId
router.get("/insights/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const countRow = await dbGet("SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?", [userId]);
    const totalEntries = countRow.count;

    if (totalEntries === 0) {
      return res.json({ totalEntries: 0, topEmotion: null, mostUsedAmbience: null, recentKeywords: [], emotionBreakdown: {}, ambienceBreakdown: {}, streak: 0 });
    }

    const topEmotionRow = await dbGet(
      "SELECT emotion, COUNT(*) as cnt FROM journal_entries WHERE user_id = ? AND emotion IS NOT NULL GROUP BY emotion ORDER BY cnt DESC LIMIT 1",
      [userId]
    );
    const emotionRows = await dbAll(
      "SELECT emotion, COUNT(*) as cnt FROM journal_entries WHERE user_id = ? AND emotion IS NOT NULL GROUP BY emotion ORDER BY cnt DESC",
      [userId]
    );
    const ambienceRow = await dbGet(
      "SELECT ambience, COUNT(*) as cnt FROM journal_entries WHERE user_id = ? GROUP BY ambience ORDER BY cnt DESC LIMIT 1",
      [userId]
    );
    const ambienceRows = await dbAll(
      "SELECT ambience, COUNT(*) as cnt FROM journal_entries WHERE user_id = ? GROUP BY ambience ORDER BY cnt DESC",
      [userId]
    );
    const recentEntries = await dbAll(
      "SELECT keywords FROM journal_entries WHERE user_id = ? AND keywords IS NOT NULL ORDER BY created_at DESC LIMIT 5",
      [userId]
    );

    const recentKeywords = [...new Set(
      recentEntries.flatMap((e) => { try { return JSON.parse(e.keywords); } catch { return []; } })
    )].slice(0, 8);

    const dates = (await dbAll(
      "SELECT DISTINCT date(created_at) as d FROM journal_entries WHERE user_id = ? ORDER BY d DESC",
      [userId]
    )).map((r) => r.d);

    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    let cursor = today;
    for (const d of dates) {
      if (d === cursor) {
        streak++;
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        cursor = prev.toISOString().slice(0, 10);
      } else break;
    }

    res.json({
      totalEntries,
      topEmotion: topEmotionRow?.emotion ?? null,
      mostUsedAmbience: ambienceRow?.ambience ?? null,
      recentKeywords,
      emotionBreakdown: Object.fromEntries(emotionRows.map((r) => [r.emotion, r.cnt])),
      ambienceBreakdown: Object.fromEntries(ambienceRows.map((r) => [r.ambience, r.cnt])),
      streak,
    });
  } catch (err) {
    console.error("GET /insights error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

module.exports = router;
