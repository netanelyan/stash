import { useState } from 'react';

/**
 * The frameless always-on-top capture window. Enter from the title (or
 * Ctrl+Enter from the body) saves into Inbox and closes; Esc closes without
 * saving. It touches nothing else: no clipboard, no focus stealing beyond its
 * own window.
 */
export default function Capture() {
  const api = window.stash;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!title.trim() && !body.trim()) { api.capture.close(); return; }
    setBusy(true);
    try {
      await api.capture.save({ title, body });
    } finally {
      api.capture.close();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); api.capture.close(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.target.tagName !== 'TEXTAREA')) { e.preventDefault(); save(); }
  };

  return (
    <div className="capture" onKeyDown={onKeyDown}>
      <input
        className="cap-title"
        autoFocus
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="Prompt..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="cap-foot">
        <span>Saves to Inbox</span>
        <span>Ctrl+Enter save &middot; Esc cancel</span>
      </div>
    </div>
  );
}
