/**
 * Subsequence fuzzy match used by quick open (Ctrl+P).
 *
 * Returns null when the query is not a subsequence of the text, otherwise
 * { score, positions }. Scoring rewards, in order: matches at the start of a
 * word ("code review" matched by "cr"), runs of consecutive characters, and
 * matches near the front of the string. Callers add a recency bonus on top.
 */
export function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = String(text || '');
  const lower = t.toLowerCase();
  if (!q) return { score: 0, positions: [] };
  if (q.length > t.length) return null;

  const positions = [];
  let ti = 0;
  let score = 0;
  let run = 0;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let i = ti; i < lower.length; i++) {
      if (lower[i] === ch) { found = i; break; }
    }
    if (found === -1) return null;

    const prev = found > 0 ? t[found - 1] : '';
    const isBoundary = found === 0 || /[\s\-_/.]/.test(prev) ||
      (/[a-z]/.test(prev) && /[A-Z]/.test(t[found]));

    if (found === ti && positions.length) { run += 1; score += 6 + run * 2; }
    else { run = 0; score += 1; }
    if (isBoundary) score += 8;
    if (t[found] === query[qi]) score += 1; // exact case
    score -= Math.min(found - ti, 10) * 0.5; // penalise skipped characters

    positions.push(found);
    ti = found + 1;
  }

  // Shorter haystacks with the same match are better matches.
  score += Math.max(0, 20 - t.length * 0.05);
  return { score, positions };
}

/**
 * Rank a list of prompts against a query. Title matches outrank path matches.
 * Recency (updated timestamp) breaks ties and orders the empty query.
 */
export function rankPrompts(query, entries, limit = 200) {
  const now = Date.now();
  const recency = (e) => {
    const t = e.updated ? Date.parse(e.updated) : 0;
    if (!t) return 0;
    const days = (now - t) / 86400000;
    return Math.max(0, 12 - days); // ~2 weeks of decay
  };

  if (!query.trim()) {
    return entries
      .slice()
      .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))
      .slice(0, limit)
      .map((entry) => ({ entry, score: 0, titlePositions: [], pathPositions: [] }));
  }

  const out = [];
  for (const entry of entries) {
    const inTitle = fuzzyMatch(query, entry.title || '');
    const inPath = fuzzyMatch(query, entry.path || '');
    if (!inTitle && !inPath) continue;
    const score = Math.max(
      inTitle ? inTitle.score + 20 : -Infinity,
      inPath ? inPath.score : -Infinity
    ) + recency(entry);
    out.push({
      entry,
      score,
      titlePositions: inTitle ? inTitle.positions : [],
      pathPositions: inTitle ? [] : (inPath ? inPath.positions : []),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// Split a string into [{ text, hit }] runs for highlighting matched characters.
export function highlightRuns(text, positions) {
  const s = String(text || '');
  if (!positions || !positions.length) return [{ text: s, hit: false }];
  const set = new Set(positions);
  const runs = [];
  let cur = '';
  let curHit = set.has(0);
  for (let i = 0; i < s.length; i++) {
    const hit = set.has(i);
    if (hit !== curHit) {
      if (cur) runs.push({ text: cur, hit: curHit });
      cur = '';
      curHit = hit;
    }
    cur += s[i];
  }
  if (cur) runs.push({ text: cur, hit: curHit });
  return runs;
}
