import { useEffect, useRef } from 'react';
import Tree from './Tree.jsx';
import { IconPlus, IconFolderPlus, IconGear } from './Icons.jsx';

// Overlay sidebar: floats above the editor, dismissed by Esc or a click on the
// scrim. Never a layout column, so the editor stays full width.
export default function Sidebar({
  vaultName, nodes, activePath, expanded, filter, tags, selectedTags,
  onFilter, onToggleTag, onToggleFolder, onOpen, onContextMenu, onNew, onNewFolder,
  onSettings, renaming, onCommitRename, onCancelRename, onMove, onRootDrop,
}) {
  const filterRef = useRef(null);
  useEffect(() => { if (filterRef.current) filterRef.current.focus(); }, []);

  return (
    <div className="sidebar" onClick={(e) => e.stopPropagation()}>
      <div className="sidebar-head">
        <div className="vault-name" title={vaultName}>{vaultName}</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" title="New prompt (Ctrl+N)" onClick={() => onNew()}><IconPlus /></button>
          <button className="icon-btn" title="New folder (Ctrl+Shift+N)" onClick={() => onNewFolder()}><IconFolderPlus /></button>
          <button className="icon-btn" title="Settings" onClick={onSettings}><IconGear /></button>
        </div>
      </div>

      <div className="sidebar-filter">
        <input
          ref={filterRef}
          value={filter}
          placeholder="Filter prompts"
          onChange={(e) => onFilter(e.target.value)}
        />
      </div>

      {tags.length > 0 && (
        <div className="tagbar">
          {tags.map((t) => (
            <button
              key={t.tag}
              className={'chip' + (selectedTags.includes(t.tag) ? ' on' : '')}
              onClick={() => onToggleTag(t.tag)}
              title={selectedTags.includes(t.tag) ? 'Remove filter' : 'Filter by this tag'}
            >
              {t.tag}<span className="count">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDrop={(e) => {
          const from = e.dataTransfer.getData('text/stash-path');
          if (from) onRootDrop(from);
        }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, null); }}
      >
        <Tree
          nodes={nodes}
          activePath={activePath}
          expanded={expanded}
          onToggleFolder={onToggleFolder}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          renaming={renaming}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onMove={onMove}
          filterActive={!!filter || selectedTags.length > 0}
        />
      </div>
    </div>
  );
}
