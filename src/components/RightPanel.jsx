import VariablesPanel from './VariablesPanel.jsx';
import HistoryPanel from './HistoryPanel.jsx';
import InfoPanel from './InfoPanel.jsx';

const TABS = [
  { key: 'variables', label: 'Variables' },
  { key: 'history', label: 'History' },
  { key: 'info', label: 'Info' },
];

export default function RightPanel(props) {
  const { active, onSelect } = props;
  return (
    <div className="panel">
      <div className="panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'active' : ''}
            onClick={() => onSelect(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {active === 'variables' && (
          <VariablesPanel
            tab={props.tab}
            values={props.variableValues}
            onChange={props.onVariableChange}
            onCopyFilled={props.onCopyFilled}
            onCopyRaw={props.onCopyRaw}
          />
        )}
        {active === 'history' && (
          <HistoryPanel
            tab={props.tab}
            snapshots={props.snapshots}
            onReload={props.onReloadHistory}
            onRestore={props.onRestore}
            api={props.api}
            toast={props.toast}
          />
        )}
        {active === 'info' && (
          <InfoPanel
            tab={props.tab}
            allTags={props.allTags}
            onTitle={props.onTitle}
            onTags={props.onTags}
            onReveal={props.onReveal}
          />
        )}
      </div>
    </div>
  );
}
