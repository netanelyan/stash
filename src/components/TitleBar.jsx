import { useRef, useState } from 'react';
import { IconMenu, IconPlus, IconPanel, IconMin, IconMax, IconClose } from './Icons.jsx';

/**
 * The tab strip *is* the title bar. Everything interactive is marked no-drag in
 * CSS; the leftover strip is the window drag handle, and double-clicking it
 * maximizes or restores like a normal Windows caption.
 */
export default function TitleBar({
  tabs, activeIndex, maximized, sidebarOpen, panelOpen,
  onSelect, onClose, onReorder, onNew, onToggleSidebar, onTogglePanel,
  onMinimize, onToggleMaximize, onCloseWindow,
}) {
  const dragIndex = useRef(null);
  const [dropHint, setDropHint] = useState(null); // { index, side }

  const onTabMouseDown = (e, i) => {
    if (e.button === 1) { e.preventDefault(); onClose(i); }
    else if (e.button === 0) onSelect(i);
  };

  const handleDragOver = (e, i) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setDropHint({ index: i, side: e.clientX < r.left + r.width / 2 ? 'left' : 'right' });
  };

  const handleDrop = (e, i) => {
    e.preventDefault();
    const from = dragIndex.current;
    const hint = dropHint;
    setDropHint(null);
    dragIndex.current = null;
    if (from == null) return;
    let to = i + (hint && hint.side === 'right' ? 1 : 0);
    if (from < to) to -= 1;
    if (to !== from) onReorder(from, to);
  };

  return (
    <div
      className="titlebar"
      onDoubleClick={(e) => {
        // only the empty (draggable) strip toggles maximize, not the tabs

        if (e.target === e.currentTarget || e.target.classList.contains('tabstrip')) onToggleMaximize();
      }}
    >
      <div className="titlebar-lead">
        <button className={'icon-btn' + (sidebarOpen ? ' active' : '')} title="Toggle sidebar (Ctrl+B)" onClick={onToggleSidebar}>
          <IconMenu />
        </button>
        <button className="icon-btn" title="New prompt (Ctrl+N)" onClick={onNew}>
          <IconPlus />
        </button>
      </div>

      <div className="tabstrip">
        {tabs.map((tab, i) => (
          <div
            key={tab.path}
            className={
              'tab' + (i === activeIndex ? ' active' : '') +
              (dropHint && dropHint.index === i ? ' drag-over-' + dropHint.side : '')
            }
            title={tab.path}
            draggable
            onMouseDown={(e) => onTabMouseDown(e, i)}
            onDragStart={() => { dragIndex.current = i; }}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={() => setDropHint(null)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={() => { dragIndex.current = null; setDropHint(null); }}
          >
            <span className="tab-label">{tab.title || tab.path}</span>
            {tab.dirty ? <span className="tab-dot" title="Unsaved changes" /> : null}
            <span
              className="tab-close"
              title="Close (Ctrl+W)"
              onMouseDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => { e.stopPropagation(); onClose(i); }}
            >
              x
            </span>
          </div>
        ))}
      </div>

      <div className="titlebar-lead">
        <button className={'icon-btn' + (panelOpen ? ' active' : '')} title="Toggle panel (Ctrl+J)" onClick={onTogglePanel}>
          <IconPanel />
        </button>
      </div>

      <div className="window-controls">
        <button onClick={onMinimize} title="Minimize"><IconMin /></button>
        <button onClick={onToggleMaximize} title={maximized ? 'Restore' : 'Maximize'}><IconMax maximized={maximized} /></button>
        <button className="close" onClick={onCloseWindow} title="Close"><IconClose /></button>
      </div>
    </div>
  );
}
