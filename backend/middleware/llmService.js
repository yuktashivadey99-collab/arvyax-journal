const crypto = require("crypto");
const { dbGet, dbRun } = require("../db/database");

async function analyzeWithLLM(text) {
  const systemPrompt = `You are an expert emotion analyst specializing in mindfulness and nature therapy.
Analyze the given journal entry and return ONLY a valid JSON object with these exact fields:
- "emotion": a single lowercase word (e.g. "calm", "anxious", "joyful", "melancholic", "energized", "grateful", "reflective")
- "keywords": an array of 3-5 lowercase strings that are thematic keywords from the text
- "summary": one concise sentence (max 20 words) summarizing the user's mental state
Return ONLY the JSON. No markdown, no explanation, no preamble.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty response from LLM");

  const clean = raw.replace(/```json|```/gi, "").trim();
  const parsed = JSON.parse(clean);

  if (!parsed.emotion || !Array.isArray(parsed.keywords) || !parsed.summary) {
    throw new Error("LLM returned unexpected shape: " + clean);
  }

  return {
    emotion: parsed.emotion.toLowerCase(),
    keywords: parsed.keywords.map((k) => k.toLowerCase()),
    summary: parsed.summary,
  };
}

async function analyzeWithCache(text) {
  const hash = crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");

  const cached = await dbGet(
    "SELECT emotion, keywords, summary FROM analysis_cache WHERE text_hash = ?",
    [hash]
  );

  if (cached) {
    return {
      emotion: cached.emotion,
      keywords: JSON.parse(cached.keywords),
      summary: cached.summary,
      cached: true,
    };
  }

  const result = await analyzeWithLLM(text);

  await dbRun(
    "INSERT OR IGNORE INTO analysis_cache (text_hash, emotion, keywords, summary) VALUES (?, ?, ?, ?)",
    [hash, result.emotion, JSON.stringify(result.keywords), result.summary]
  );

  return { ...result, cached: false };
}

async function analyzeStreaming(text, res) {
  const systemPrompt = `You are an expert emotion analyst. Return ONLY a valid JSON with: "emotion" (single lowercase word), "keywords" (array of 3-5 lowercase strings), "summary" (one sentence max 20 words). No markdown.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
    }),
  });

  if (!response.ok) throw new Error(`LLM stream error ${response.status}`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullText = "";
  for await (const chunk of response.body) {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const event = JSON.parse(data);
          const delta = event.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            res.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
          }
        } catch (_) {}
      }
    }
  }
  try {
    const clean = fullText.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(clean);
    res.write(`data: ${JSON.stringify({ done: true, result: parsed })}\n\n`);
  } catch {
    res.write(`data: ${JSON.stringify({ done: true, error: "Parse failed" })}\n\n`);
  }
  res.end();
}

module.exports = { analyzeWithCache, analyzeStreaming };