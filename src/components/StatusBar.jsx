import { clockTime } from '../lib/time.js';

// path | chars | ~tokens | save state
export default function StatusBar({ tab, onReloadFromDisk }) {
  if (!tab) {
    return (
      <div className="statusbar">
        <span className="path">No prompt open</span>
      </div>
    );
  }
  const chars = tab.body.length;
  const tokens = Math.round(chars / 4); // rough, chars / 4

  return (
    <div className="statusbar">
      <span className="path" title={tab.path}>{tab.path}</span>
      {tab.diskChanged && (
        <span className="warn">
          changed on disk{' '}
          <button onClick={onReloadFromDisk}>reload</button>
        </span>
      )}
      <span>{chars.toLocaleString()} chars</span>
      <span>~{tokens.toLocaleString()} tokens</span>
      <SaveState state={tab.save} />
    </div>
  );
}

function SaveState({ state }) {
  if (!state) return <span>&nbsp;</span>;
  if (state.status === 'saving') return <span>Saving...</span>;
  if (state.status === 'error') return <span className="err" title={state.message}>Save failed: {state.message}</span>;
  if (state.status === 'saved') return <span>Saved {clockTime(state.at)}</span>;
  return <span>&nbsp;</span>;
}
