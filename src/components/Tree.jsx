import { useEffect, useRef, useState } from 'react';
import { IconChevron, IconFile } from './Icons.jsx';

/**
 * The folder tree. Folders collapse (state persisted by App), rows rename in
 * place, and a prompt can be dragged onto a folder to move it.
 */
export default function Tree({
  nodes, activePath, expanded, onToggleFolder, onOpen, onContextMenu,
  renaming, onCommitRename, onCancelRename, onMove, filterActive,
}) {
  if (!nodes.length) {
    return <div className="tree-empty">{filterActive ? 'Nothing matches.' : 'No prompts yet. Ctrl+N makes one.'}</div>;
  }
  return (
    <div className="tree">
      {nodes.map((n) => (
        <Node
          key={n.path}
          node={n}
          depth={0}
          activePath={activePath}
          expanded={expanded}
          onToggleFolder={onToggleFolder}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          renaming={renaming}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function Node(props) {
  const { node, depth, activePath, expanded, onToggleFolder, onOpen, onContextMenu, renaming, onCommitRename, onCancelRename, onMove } = props;
  const [dropTarget, setDropTarget] = useState(false);
  const isFolder = node.type === 'folder';
  const isOpen = isFolder && expanded.has(node.path);
  const isRenaming = renaming && renaming.path === node.path;
  const indent = 6 + depth * 12;

  const rowProps = {
    className:
      'row ' + (isFolder ? 'folder' : 'file') +
      (node.path === activePath ? ' selected' : '') +
      (dropTarget ? ' drop-target' : ''),
    style: { paddingLeft: indent },
    onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node); },
    draggable: !isRenaming,
    onDragStart: (e) => {
      e.stopPropagation();
      e.dataTransfer.setData('text/stash-path', node.path);
      e.dataTransfer.effectAllowed = 'move';
    },
  };

  if (isFolder) {
    rowProps.onClick = () => onToggleFolder(node.path);
    rowProps.onDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(true);
    };
    rowProps.onDragLeave = () => setDropTarget(false);
    rowProps.onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(false);
      const from = e.dataTransfer.getData('text/stash-path');
      if (from && from !== node.path) onMove(from, node.path);
    };
  } else {
    rowProps.onClick = () => onOpen(node.path);
  }

  return (
    <>
      <div {...rowProps}>
        <span className="caret">
          {isFolder ? <IconChevron style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} /> : <IconFile width="12" height="12" />}
        </span>
        {isRenaming
          ? <RenameInput initial={renaming.initial} onCommit={(v) => onCommitRename(node, v)} onCancel={onCancelRename} />
          : <span className="label">{isFolder ? node.name : node.title}</span>}
      </div>
      {isFolder && isOpen && node.children.map((c) => (
        <Node key={c.path} {...props} node={c} depth={depth + 1} />
      ))}
    </>
  );
}

function RenameInput({ initial, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) { ref.current.focus(); ref.current.select(); }
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={initial}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onCommit(e.currentTarget.value); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      }}
    />
  );
}
