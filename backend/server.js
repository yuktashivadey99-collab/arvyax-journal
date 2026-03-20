require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { initSchema } = require("./db/database");
const journalRoutes = require("./routes/journal");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "16kb" }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const analyzeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: "Analysis rate limit reached." } });

app.use("/api", apiLimiter);
app.use("/api/journal/analyze", analyzeLimiter);
app.use("/api/journal", journalRoutes);

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

initSchema().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌿 ArvyaX Journal API running on http://localhost:${PORT}`);
    console.log(`   Health:   GET  /health`);
    console.log(`   Journal:  POST /api/journal`);
    console.log(`   Entries:  GET  /api/journal/:userId`);
    console.log(`   Analyze:  POST /api/journal/analyze`);
    console.log(`   Insights: GET  /api/journal/insights/:userId\n`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

module.exports = app;
