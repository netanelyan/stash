import { useEffect, useMemo, useState } from 'react';
import { diffLines, collapseUnchanged, diffStats } from '../lib/diff.js';
import { relativeTime, fullTime } from '../lib/time.js';

/**
 * Snapshot list plus a line diff of the selected snapshot against the current
 * content. Restore hands the work back to main, which snapshots the current
 * state first so restoring is itself undoable.
 */
export default function HistoryPanel({ tab, snapshots, onReload, onRestore, api, toast }) {
  const [selected, setSelected] = useState(null);
  const [snapText, setSnapText] = useState('');

  useEffect(() => { setSelected(null); setSnapText(''); }, [tab && tab.path]);

  useEffect(() => {
    let cancelled = false;
    if (!selected || !tab) return undefined;
    api.history.read(tab.id, selected.file)
      .then((text) => { if (!cancelled) setSnapText(text); })
      .catch((err) => toast('Could not read snapshot: ' + err.message, 'error'));
    return () => { cancelled = true; };
  }, [selected, tab && tab.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!selected || !tab) return null;
    // Compare bodies only: frontmatter timestamps change on every save and
    // would swamp the diff.
    return collapseUnchanged(diffLines(stripFrontmatter(snapText), tab.body), 3);
  }, [snapText, tab && tab.body, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tab) return <div className="muted">No prompt open.</div>;

  const stats = rows ? diffStats(rows) : null;

  return (
    <div>
      <div className="kv" style={{ marginBottom: 6 }}>
        <span className="k">{snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'}</span>
        <button className="k" style={{ textDecoration: 'underline' }} onClick={onReload}>refresh</button>
      </div>

      {snapshots.length === 0 && (
        <div className="muted" style={{ padding: '2px 0 10px' }}>
          No versions yet. Stash snapshots a prompt when it changes, at most once a minute.
        </div>
      )}

      <div className="snap-list">
        {snapshots.map((s) => (
          <div
            key={s.file}
            className={'snap' + (selected && selected.file === s.file ? ' on' : '')}
            title={fullTime(s.time)}
            onClick={() => setSelected(s)}
          >
            <span>{relativeTime(s.time)}</span>
          </div>
        ))}
      </div>

      {selected && (
        <>
          <div className="panel-actions">
            <button className="btn primary" onClick={() => onRestore(selected)}>Restore this version</button>
          </div>
          {stats && (
            <div className="kv" style={{ marginBottom: 4 }}>
              <span className="k">vs current</span>
              <span className="v">
                <span style={{ color: 'var(--added)' }}>+{stats.added}</span>{' '}
                <span style={{ color: 'var(--removed)' }}>-{stats.removed}</span>
              </span>
            </div>
          )}
          <div className="diff">
            {rows && rows.length === 0 && <div className="dl">identical</div>}
            {rows && rows.map((r, i) =>
              r.type === 'gap' ? (
                <div className="dl gap" key={i}><span className="sign" /> {r.count} unchanged lines</div>
              ) : (
                <div className={'dl ' + r.type} key={i}>
                  <span className="sign">{r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '}</span>
                  <span>{r.text || ' '}</span>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

function stripFrontmatter(raw) {
  const m = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(String(raw || ''));
  return m ? String(raw).slice(m[0].length).replace(/^\r?\n/, '') : String(raw || '');
}
