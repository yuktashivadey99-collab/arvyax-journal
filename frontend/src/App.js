import React, { useState, useEffect, useCallback, useRef } from "react";
import { createEntry, getEntries, analyzeEntry, getInsights } from "./api/journal";
import "./App.css";

const AMBIENCES = [
  { id:"forest",   emoji:"🌲", label:"Forest",   accent:"#4ecb71" },
  { id:"ocean",    emoji:"🌊", label:"Ocean",    accent:"#38b6e8" },
  { id:"mountain", emoji:"⛰️",  label:"Mountain", accent:"#c084fc" },
  { id:"desert",   emoji:"🏜️", label:"Desert",   accent:"#fb923c" },
  { id:"meadow",   emoji:"🌸", label:"Meadow",   accent:"#86efac" },
];

const EMOTION_COLORS = {
  calm:"#4ecb71", peaceful:"#6ee7b7", joyful:"#fbbf24", grateful:"#a78bfa",
  reflective:"#60a5fa", melancholic:"#818cf8", anxious:"#f87171",
  energized:"#fb923c", happy:"#fde68a", sad:"#94a3b8",
};

const USER_ID = "demo-user-001";

function Scene({ ambience }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, particles = [];

    const configs = {
      forest:   { count:80, color:"#4ecb71", speed:0.4, size:[1,3], type:"leaf"   },
      ocean:    { count:60, color:"#38b6e8", speed:0.6, size:[2,5], type:"bubble" },
      mountain: { count:50, color:"#c084fc", speed:0.2, size:[1,2], type:"star"   },
      desert:   { count:40, color:"#fb923c", speed:0.8, size:[1,3], type:"dust"   },
      meadow:   { count:90, color:"#86efac", speed:0.3, size:[2,4], type:"petal"  },
    };

    const cfg = configs[ambience] || configs.forest;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function init() {
      resize();
      particles = Array.from({ length: cfg.count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        size: cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]),
        vx: (Math.random() - 0.5) * cfg.speed,
        vy: -Math.random() * cfg.speed - 0.1,
        opacity: Math.random() * 0.5 + 0.1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.005,
      }));
    }

    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return `${r},${g},${b}`;
    }

    const rgb = hexToRgb(cfg.color);

    function drawParticle(p) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = `rgba(${rgb},1)`;
      ctx.strokeStyle = `rgba(${rgb},0.6)`;
      if (cfg.type === "leaf") {
        ctx.beginPath();
        ctx.ellipse(0,0,p.size*2,p.size*0.8,0,0,Math.PI*2);
        ctx.fill();
      } else if (cfg.type === "bubble") {
        ctx.beginPath();
        ctx.arc(0,0,p.size,0,Math.PI*2);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else if (cfg.type === "star") {
        ctx.beginPath();
        ctx.arc(0,0,p.size*0.5,0,Math.PI*2);
        ctx.fill();
      } else if (cfg.type === "dust") {
        ctx.beginPath();
        ctx.ellipse(0,0,p.size*3,p.size*0.5,0,0,Math.PI*2);
        ctx.fill();
      } else if (cfg.type === "petal") {
        ctx.beginPath();
        ctx.ellipse(0,0,p.size*1.5,p.size*0.7,0,0,Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    function tick() {
      ctx.clearRect(0,0,W,H);
      for (const p of particles) {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.3;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity += (Math.random() - 0.5) * 0.005;
        p.opacity = Math.max(0.05, Math.min(0.6, p.opacity));
        if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        drawParticle(p);
      }
      animRef.current = requestAnimationFrame(tick);
    }

    init();
    tick();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [ambience]);

  return (
    <div className="scene">
      <canvas ref={canvasRef} />
      <div className="scene-overlay" />
    </div>
  );
}

export default function App() {
  const [view,      setView]      = useState("write");
  const [ambience,  setAmbience]  = useState("forest");
  const [text,      setText]      = useState("");
  const [entries,   setEntries]   = useState([]);
  const [insights,  setInsights]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [toast,     setToast]     = useState(null);

  const amb = AMBIENCES.find(a => a.id === ambience);

  const notify = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadEntries = useCallback(async () => {
    try { const d = await getEntries(USER_ID); setEntries(d.entries); }
    catch { notify("Could not load entries", "error"); }
  }, []);

  const loadInsights = useCallback(async () => {
    try { const d = await getInsights(USER_ID); setInsights(d); }
    catch { notify("Could not load insights", "error"); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { if (view === "insights") loadInsights(); }, [view, loadInsights]);

  async function handleSave() {
    if (text.trim().length < 10) { notify("Write at least 10 characters", "error"); return; }
    setSaving(true);
    try {
      await createEntry(USER_ID, ambience, text);
      notify("Entry saved ✦");
      setText("");
      await loadEntries();
    } catch(e) { notify(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function handleAnalyze(id) {
    setAnalyzing(id);
    try {
      const r = await analyzeEntry(id);
      setEntries(prev => prev.map(e => e.id === id ? r.entry : e));
      notify(`Emotion: ${r.entry.emotion}${r.cached ? " (cached)" : ""}`);
    } catch(e) { notify("Analysis failed: " + e.message, "error"); }
    finally { setAnalyzing(null); }
  }

  return (
    <div className="app" data-amb={ambience}>
      <Scene ambience={ambience} />

      <header className="header">
        <div className="logo">
          <div className="logo-mark">✦</div>
          <span className="logo-name">Arvy<span>aX</span></span>
        </div>
        <nav className="nav">
          {[
            { id:"write",    icon:"✍️", label:"Write"    },
            { id:"entries",  icon:"📖", label:"Entries"  },
            { id:"insights", icon:"✨", label:"Insights" },
          ].map(v => (
            <button key={v.id} className={`nav-btn ${view === v.id ? "active" : ""}`} onClick={() => setView(v.id)}>
              <span className="nav-icon">{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="main">

        {view === "write" && (
          <div className="fade-in">
            <div className="write-hero">
              <h1>Your <em>nature</em> reflection</h1>
              <p>Capture what the session awakened in you</p>
            </div>

            <div className="ambience-row">
              {AMBIENCES.map(a => (
                <button key={a.id}
                  className={`amb-pill ${ambience === a.id ? "active" : ""}`}
                  style={{ "--accent": a.accent, "--glow": a.accent + "30" }}
                  onClick={() => setAmbience(a.id)}>
                  <span className="amb-emoji">{a.emoji}</span>
                  <span className="amb-text">{a.label}</span>
                </button>
              ))}
            </div>

            <div className="editor-card">
              <div className="editor-topbar">
                <span className="editor-label">{amb.emoji} {amb.label} Session</span>
                <span className="editor-meta">{text.length} characters</span>
              </div>
              <textarea className="editor" rows={8} value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Describe your ${amb.label.toLowerCase()} experience...`}
              />
              <div className="editor-bottom">
                <span className="editor-hint">Write freely, without judgment</span>
                <button className="save-btn" onClick={handleSave} disabled={saving || text.length < 10}>
                  {saving ? <><span className="spin" /> Saving...</> : <>Save Entry ✦</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "entries" && (
          <div className="fade-in">
            <div className="view-header">
              <h1>Your <em>Journal</em></h1>
              <span className="view-count">{entries.length} entries</span>
            </div>
            {entries.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">🌱</span>
                <p>No entries yet. Begin your first reflection.</p>
                <button className="cta-btn" onClick={() => setView("write")}>Write Now</button>
              </div>
            ) : (
              <div className="entries-list">
                {entries.map(entry => {
                  const a = AMBIENCES.find(x => x.id === entry.ambience);
                  const eClr = EMOTION_COLORS[entry.emotion] || "#888";
                  return (
                    <div key={entry.id} className="entry-card"
                      style={{ "--accent": a?.accent || "#4ecb71", "--glow": (a?.accent || "#4ecb71") + "30" }}>
                      <div className="entry-header">
                        <div className="entry-tags">
                          <span className="entry-amb">{a?.emoji} {a?.label}</span>
                          <span className="entry-date">
                            {new Date(entry.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                          </span>
                        </div>
                        {entry.emotion && (
                          <span className="emotion-badge"
                            style={{ color: eClr, borderColor: eClr + "44", background: eClr + "15" }}>
                            {entry.emotion}
                          </span>
                        )}
                      </div>
                      <p className="entry-text">"{entry.text}"</p>
                      {entry.summary && (
                        <div className="entry-analysis">
                          <p className="analysis-summary">💭 {entry.summary}</p>
                          {entry.keywords && (
                            <div className="analysis-keywords">
                              {entry.keywords.map(k => <span key={k} className="kw">#{k}</span>)}
                            </div>
                          )}
                        </div>
                      )}
                      {!entry.emotion && (
                        <button className="analyze-btn"
                          onClick={() => handleAnalyze(entry.id)}
                          disabled={!!analyzing}>
                          {analyzing === entry.id
                            ? <><span className="spin-w" /> Analyzing...</>
                            : <><span className="dot" /> Analyze Emotions</>}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "insights" && (
          <div className="fade-in">
            <div className="view-header">
              <h1>Your <em>Insights</em></h1>
              <span className="view-count">patterns over time</span>
            </div>
            {!insights ? (
              <div className="empty"><span className="empty-icon">⏳</span><p>Loading...</p></div>
            ) : insights.totalEntries === 0 ? (
              <div className="empty">
                <span className="empty-icon">🌱</span>
                <p>Write and analyze entries to see insights.</p>
              </div>
            ) : (
              <div className="insights-grid">
                <div className="ins-card">
                  <div className="ins-label">Total Entries</div>
                  <div className="ins-value big">{insights.totalEntries}</div>
                  <div className="ins-sub">sessions journaled</div>
                </div>
                <div className="ins-card">
                  <div className="ins-label">Day Streak</div>
                  <div className="ins-value big">{insights.streak}</div>
                  <div className="ins-sub">consecutive days 🔥</div>
                </div>
                {insights.topEmotion && (
                  <div className="ins-card accent-card"
                    style={{ "--accent": EMOTION_COLORS[insights.topEmotion] || "#4ecb71", "--glow": (EMOTION_COLORS[insights.topEmotion] || "#4ecb71") + "30" }}>
                    <div className="ins-label">Dominant Emotion</div>
                    <div className="ins-value">{insights.topEmotion}</div>
                    <div className="ins-sub">most felt across sessions</div>
                  </div>
                )}
                {insights.mostUsedAmbience && (
                  <div className="ins-card">
                    <div className="ins-label">Favourite Ambience</div>
                    <div className="ins-value">
                      {AMBIENCES.find(a => a.id === insights.mostUsedAmbience)?.emoji} {insights.mostUsedAmbience}
                    </div>
                    <div className="ins-sub">most visited nature scene</div>
                  </div>
                )}
                {Object.keys(insights.emotionBreakdown || {}).length > 0 && (
                  <div className="ins-card wide">
                    <div className="ins-label">Emotion Breakdown</div>
                    <div className="bar-list">
                      {Object.entries(insights.emotionBreakdown).map(([e, cnt]) => {
                        const total = Object.values(insights.emotionBreakdown).reduce((a,b) => a+b, 0);
                        const pct = Math.round(cnt / total * 100);
                        const clr = EMOTION_COLORS[e] || "#888";
                        return (
                          <div key={e} className="bar-item">
                            <span className="bar-name">{e}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width:`${pct}%`, background:clr }} />
                            </div>
                            <span className="bar-pct">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {Object.keys(insights.ambienceBreakdown || {}).length > 0 && (
                  <div className="ins-card wide">
                    <div className="ins-label">Ambience Breakdown</div>
                    <div className="bar-list">
                      {Object.entries(insights.ambienceBreakdown).map(([a, cnt]) => {
                        const total = Object.values(insights.ambienceBreakdown).reduce((x,y) => x+y, 0);
                        const pct = Math.round(cnt / total * 100);
                        const ac = AMBIENCES.find(x => x.id === a);
                        return (
                          <div key={a} className="bar-item">
                            <span className="bar-name">{ac?.emoji} {a}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width:`${pct}%`, background:ac?.accent || "#4ecb71" }} />
                            </div>
                            <span className="bar-pct">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {insights.recentKeywords?.length > 0 && (
                  <div className="ins-card wide">
                    <div className="ins-label">Recent Themes</div>
                    <div className="kw-cloud">
                      {insights.recentKeywords.map(k => (
                        <span key={k} className="kw-big">#{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === "error" ? "✗ " : "✓ "}{toast.msg}
        </div>
      )}
    </div>
  );
}