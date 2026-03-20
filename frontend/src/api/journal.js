const BASE = process.env.REACT_APP_API_URL || "/api";

export async function createEntry(userId, ambience, text) {
  const res = await fetch(`${BASE}/journal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ambience, text }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function getEntries(userId) {
  const res = await fetch(`${BASE}/journal/${userId}?limit=50`);
  if (!res.ok) throw new Error("Failed to fetch entries");
  return res.json();
}

export async function analyzeText(text) {
  const res = await fetch(`${BASE}/journal/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function analyzeEntry(entryId) {
  const res = await fetch(`${BASE}/journal/${entryId}/analyze`, {
    method: "POST",
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function getInsights(userId) {
  const res = await fetch(`${BASE}/journal/insights/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}
