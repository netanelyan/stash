import { useMemo } from 'react';
import { parseVariables } from '../lib/variables.js';

export default function VariablesPanel({ tab, values, onChange, onCopyFilled, onCopyRaw }) {
  const body = tab ? tab.body : '';
  const vars = useMemo(() => parseVariables(body), [body]);

  if (!tab) return <div className="muted">No prompt open.</div>;

  return (
    <div>
      {vars.length === 0 ? (
        <div className="muted" style={{ padding: '2px 0 12px' }}>
          No variables in this prompt. Write <code>{'{{name}}'}</code> or{' '}
          <code>{'{{name|default}}'}</code> in the body to add one.
        </div>
      ) : (
        vars.map((v) => (
          <div className="field" key={v.name}>
            <label htmlFor={'var-' + v.name}>{v.name}</label>
            <input
              id={'var-' + v.name}
              value={values[v.name] !== undefined ? values[v.name] : v.def}
              placeholder={v.def || 'empty'}
              onChange={(e) => onChange(v.name, e.target.value)}
            />
          </div>
        ))
      )}

      <div className="panel-actions">
        <button className="btn primary" onClick={onCopyFilled} title="Ctrl+Shift+C">Copy filled</button>
        <button className="btn" onClick={onCopyRaw} title="Ctrl+Shift+V">Copy raw</button>
      </div>
    </div>
  );
}
