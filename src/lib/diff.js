/**
 * Line-level diff via a plain LCS table. Version snapshots are prompt-sized, so
 * O(n*m) is fine and the code stays something you can read in one sitting.
 * Returns rows: { type: 'same' | 'add' | 'del', text, aLine, bLine }.
 */
export function diffLines(oldText, newText) {
  const a = String(oldText || '').split('\n');
  const b = String(newText || '').split('\n');

  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i], aLine: i + 1, bLine: j + 1 });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: 'del', text: a[i], aLine: i + 1, bLine: null });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j], aLine: null, bLine: j + 1 });
      j++;
    }
  }
  while (i < n) { rows.push({ type: 'del', text: a[i], aLine: i + 1, bLine: null }); i++; }
  while (j < m) { rows.push({ type: 'add', text: b[j], aLine: null, bLine: j + 1 }); j++; }
  return rows;
}

// Collapse long stretches of unchanged lines, keeping `context` on each side.
export function collapseUnchanged(rows, context = 3) {
  const keep = new Array(rows.length).fill(false);
  rows.forEach((r, idx) => {
    if (r.type === 'same') return;
    for (let k = idx - context; k <= idx + context; k++) if (k >= 0 && k < rows.length) keep[k] = true;
  });
  const out = [];
  let skipped = 0;
  rows.forEach((r, idx) => {
    if (keep[idx]) {
      if (skipped) { out.push({ type: 'gap', count: skipped }); skipped = 0; }
      out.push(r);
    } else {
      skipped++;
    }
  });
  if (skipped) out.push({ type: 'gap', count: skipped });
  return out;
}

export function diffStats(rows) {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.type === 'add') added++;
    else if (r.type === 'del') removed++;
  }
  return { added, removed };
}
