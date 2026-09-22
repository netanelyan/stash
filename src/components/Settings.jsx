import { useState } from 'react';

// Vault location and the global capture shortcut. Also where a failed shortcut
// registration surfaces, so the user can pick a combination that is free.
export default function Settings({ api, info, shortcut, onVaultChanged, onClose, toast }) {
  const [state, setState] = useState(shortcut || { accelerator: 'Control+Alt+S', registered: false, error: null });
  const [capturing, setCapturing] = useState(false);

  const pickVault = async () => {
    const dir = await api.vault.pickRoot();
    if (!dir) return;
    const snap = await api.vault.setRoot(dir);
    onVaultChanged(snap);
    toast('Vault is now ' + dir);
  };

  // Read a key combination straight off the next keydown and hand Electron's
  // accelerator string to main.
  const onCaptureKey = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const key = e.key;
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;
    const parts = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    if (!parts.length) { toast('Use at least one modifier', 'error'); return; }
    parts.push(key.length === 1 ? key.toUpperCase() : key);
    const accel = parts.join('+');
    setCapturing(false);
    const next = await api.shortcut.set(accel);
    setState(next);
    if (!next.registered) toast('Could not register ' + accel + ': ' + (next.error || 'unavailable'), 'error');
  };

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" style={{ width: 520 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="group-head" style={{ padding: '10px 14px' }}>Settings</div>
        <div className="panel-body">
          <div className="field">
            <label>Vault folder</label>
            <div className="kv"><span className="v" style={{ textAlign: 'left' }}>{info.root}</span></div>
            <div className="panel-actions">
              <button className="btn" onClick={pickVault}>Change vault folder...</button>
            </div>
          </div>

          <div className="field" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <label>Global quick capture shortcut</label>
            <div className="panel-actions">
              <button
                className={'btn' + (capturing ? ' primary' : '')}
                onClick={() => setCapturing(true)}
                onKeyDown={capturing ? onCaptureKey : undefined}
              >
                {capturing ? 'Press a combination...' : state.accelerator}
              </button>
              <button className="btn" onClick={async () => setState(await api.shortcut.set('Control+Alt+S'))}>
                Reset to Ctrl+Alt+S
              </button>
            </div>
            {state.registered
              ? <div className="muted" style={{ padding: 0 }}>Registered. Works anywhere in Windows.</div>
              : <div className="muted" style={{ padding: 0, color: 'var(--danger)' }}>
                  Not registered{state.error ? ': ' + state.error : ''}. Pick another combination.
                </div>}
          </div>

          <div className="field" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div className="kv"><span className="k">Version</span><span className="v">{info.version}</span></div>
            <div className="kv"><span className="k">Prompts</span><span className="v">{info.count}</span></div>
          </div>
        </div>
        <div className="modal-foot"><span>Esc close</span></div>
      </div>
    </div>
  );
}
