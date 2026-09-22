import TagInput from './TagInput.jsx';
import { fullTime, relativeTime } from '../lib/time.js';

export default function InfoPanel({ tab, allTags, onTitle, onTags, onReveal }) {
  if (!tab) return <div className="muted">No prompt open.</div>;

  const chars = tab.body.length;
  const words = tab.body.trim() ? tab.body.trim().split(/\s+/).length : 0;
  const lines = tab.body.split('\n').length;

  return (
    <div>
      <div className="field">
        <label htmlFor="info-title">Title</label>
        <input
          id="info-title"
          value={tab.title}
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Tags</label>
        <TagInput tags={tab.tags} allTags={allTags} onChange={onTags} />
      </div>

      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <div className="kv"><span className="k">Path</span><span className="v">{tab.path}</span></div>
        <div className="kv"><span className="k">Id</span><span className="v">{tab.id}</span></div>
        <div className="kv"><span className="k">Created</span><span className="v" title={fullTime(tab.created)}>{tab.created ? relativeTime(tab.created) : 'unknown'}</span></div>
        <div className="kv"><span className="k">Updated</span><span className="v" title={fullTime(tab.updated)}>{tab.updated ? relativeTime(tab.updated) : 'unknown'}</span></div>
        <div className="kv"><span className="k">Lines</span><span className="v">{lines}</span></div>
        <div className="kv"><span className="k">Words</span><span className="v">{words}</span></div>
        <div className="kv"><span className="k">Characters</span><span className="v">{chars}</span></div>
      </div>

      <div className="panel-actions" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onReveal}>Reveal in Explorer</button>
      </div>
    </div>
  );
}
