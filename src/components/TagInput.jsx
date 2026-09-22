import { useMemo, useState } from 'react';

// Chip input with autocomplete over every tag already used in the vault.
export default function TagInput({ tags, allTags, onChange }) {
  const [draft, setDraft] = useState('');
  const [hi, setHi] = useState(0);

  const suggestions = useMemo(() => {
    const d = draft.trim().toLowerCase();
    if (!d) return [];
    return allTags
      .filter((t) => t.toLowerCase().includes(d) && !tags.includes(t))
      .slice(0, 8);
  }, [draft, allTags, tags]);

  const add = (value) => {
    const t = String(value || '').trim().replace(/,/g, '');
    setDraft('');
    setHi(0);
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
  };

  const remove = (t) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="tag-input-wrap">
      {tags.length > 0 && (
        <div className="tag-chips">
          {tags.map((t) => (
            <span className="chip on" key={t}>
              {t}
              <span className="x" title="Remove tag" onClick={() => remove(t)}>x</span>
            </span>
          ))}
        </div>
      )}
      <input
        value={draft}
        placeholder="Add a tag"
        onChange={(e) => { setDraft(e.target.value); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(suggestions.length && draft.trim() ? suggestions[hi] || draft : draft);
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          } else if (e.key === 'ArrowDown' && suggestions.length) {
            e.preventDefault();
            setHi((h) => (h + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp' && suggestions.length) {
            e.preventDefault();
            setHi((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Escape' && draft) {
            // only swallow Esc while there is a draft to throw away
            e.stopPropagation();
            setDraft('');
          }
        }}
        onBlur={() => setTimeout(() => setDraft(''), 120)}
      />
      {suggestions.length > 0 && (
        <div className="autocomplete">
          {suggestions.map((s, i) => (
            <div key={s} className={i === hi ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); add(s); }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
