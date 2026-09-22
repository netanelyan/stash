import { useEffect, useMemo, useRef, useState } from 'react';
import { rankPrompts, highlightRuns } from '../lib/fuzzy.js';

// Ctrl+P. Subsequence match over title and path, ranked by match quality then
// recency, with the matched characters highlighted.
export default function QuickOpen({ entries, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  const results = useMemo(() => rankPrompts(query, entries, 80), [query, entries]);

  useEffect(() => { setSel(0); }, [query]);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('.result.on');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel, results]);

  const key = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[sel]) onPick(results[sel].entry.path); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="search-input"
          autoFocus
          value={query}
          placeholder="Go to prompt"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={key}
        />
        <div className="results" ref={listRef}>
          {results.length === 0 && <div className="muted">No matches.</div>}
          {results.map((r, i) => (
            <div
              key={r.entry.path}
              className={'result' + (i === sel ? ' on' : '')}
              onMouseMove={() => setSel(i)}
              onClick={() => onPick(r.entry.path)}
            >
              <div className="r-title">
                {highlightRuns(r.entry.title, r.titlePositions).map((run, k) => (
                  <span key={k} className={run.hit ? 'hit' : ''}>{run.text}</span>
                ))}
              </div>
              <div className="r-path">
                {highlightRuns(r.entry.path, r.pathPositions).map((run, k) => (
                  <span key={k} className={run.hit ? 'hit' : ''}>{run.text}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot"><span>Enter open</span><span>Esc close</span></div>
      </div>
    </div>
  );
}
