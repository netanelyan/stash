import { useEffect, useMemo, useRef, useState } from 'react';

// Ctrl+Shift+F. Main does the scanning over its in-memory index and hands back
// results grouped by file; clicking one opens the prompt at that line.
export default function FullTextSearch({ api, onPick, onClose, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (!q) { setGroups([]); return undefined; }
    const t = setTimeout(() => {
      api.search.fullText(q).then((res) => { if (!cancelled) { setGroups(res); setSel(0); } });
    }, 90);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, api]);

  // Flatten to a single navigable list of matches.
  const flat = useMemo(() => {
    const out = [];
    for (const g of groups) for (const m of g.matches) out.push({ group: g, match: m });
    return out;
  }, [groups]);

  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('.result.on');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel, flat]);

  const key = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = flat[sel];
      if (hit) onPick(hit.group.path, hit.match);
    } else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let flatIndex = -1;

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" style={{ maxHeight: '72vh' }} onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="search-input"
          autoFocus
          value={query}
          placeholder="Search all prompts"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={key}
        />
        <div className="results" ref={listRef}>
          {query.trim() && groups.length === 0 && <div className="muted">No matches.</div>}
          {groups.map((g) => (
            <div key={g.path}>
              <div className="group-head">
                {g.title}<span className="g-path">{g.path}</span>
              </div>
              {g.matches.map((m) => {
                flatIndex += 1;
                const i = flatIndex;
                return (
                  <div
                    key={m.line + ':' + m.col}
                    className={'result' + (i === sel ? ' on' : '')}
                    onMouseMove={() => setSel(i)}
                    onClick={() => onPick(g.path, m)}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span className="line-no">{m.line + 1}</span>
                      <span className="line-text">{renderLine(m.text, m.col, query.trim().length)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <span>{flat.length} match{flat.length === 1 ? '' : 'es'} in {groups.length} file{groups.length === 1 ? '' : 's'}</span>
          <span>Enter open</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

function renderLine(text, col, len) {
  const start = Math.max(0, col - 30);
  const head = (start > 0 ? '...' : '') + text.slice(start, col);
  const hit = text.slice(col, col + len);
  const tail = text.slice(col + len, col + len + 160);
  return (<>{head}<mark>{hit}</mark>{tail}</>);
}
