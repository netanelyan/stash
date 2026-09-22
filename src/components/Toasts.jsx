export default function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'toast' + (t.kind === 'error' ? ' error' : '') + (t.leaving ? ' leaving' : '')}>
          <span>{t.message}</span>
          {t.action && <button onClick={() => { t.action.run(); onDismiss(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
