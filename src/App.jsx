import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TitleBar from './components/TitleBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Editor from './components/Editor.jsx';
import RightPanel from './components/RightPanel.jsx';
import StatusBar from './components/StatusBar.jsx';
import QuickOpen from './components/QuickOpen.jsx';
import FullTextSearch from './components/FullTextSearch.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import Settings from './components/Settings.jsx';
import Toasts from './components/Toasts.jsx';
import { fillVariables } from './lib/variables.js';

const api = window.stash;
const SAVE_DEBOUNCE_MS = 400;

export default function App() {
  const [info, setInfo] = useState({ root: '', name: 'Stash', version: '', shortcut: null });
  const [tree, setTree] = useState([]);
  const [index, setIndex] = useState([]);
  const [tagList, setTagList] = useState([]);

  const [tabs, setTabs] = useState([]);
  const [active, setActive] = useState(-1);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('variables');
  const [fontSize, setFontSize] = useState(14);
  const [maximized, setMaximized] = useState(false);

  const [filter, setFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());

  const [quickOpen, setQuickOpen] = useState(false);
  const [ftsOpen, setFtsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [reveal, setReveal] = useState(null);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(active);
  activeRef.current = active;
  const saveTimers = useRef(new Map());
  const cursors = useRef(new Map());
  const persistTimer = useRef(null);

  const activeTab = active >= 0 && active < tabs.length ? tabs[active] : null;
  const allTagNames = useMemo(() => tagList.map((t) => t.tag), [tagList]);

  // ------------------------------------------------------------- toasts

  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 200);
  }, []);

  const toast = useCallback((message, kind, action, ms) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, message, kind, action }]);
    setTimeout(() => dismissToast(id), ms || (action ? 6000 : 2600));
    return id;
  }, [dismissToast]);

  // ------------------------------------------------------- vault refresh

  const applySnapshot = useCallback((snap) => {
    setTree(snap.tree);
    setIndex(snap.index);
    setTagList(snap.tags);
  }, []);

  const refresh = useCallback(async () => {
    applySnapshot(await api.vault.tree());
  }, [applySnapshot]);

  // ------------------------------------------------------------- saving

  const updateTab = useCallback((path, fn) => {
    setTabs((ts) => ts.map((t) => (t.path === path ? fn(t) : t)));
  }, []);

  const cleanError = (err) => String((err && err.message) || err).replace(/^Error invoking remote method '[^']*':\s*/, '');

  const saveNow = useCallback(async (path) => {
    const timer = saveTimers.current.get(path);
    if (timer) { clearTimeout(timer); saveTimers.current.delete(path); }
    const tab = tabsRef.current.find((t) => t.path === path);
    if (!tab || !tab.dirty) return;

    const sent = { body: tab.body, title: tab.title, tags: tab.tags.join('\u0000') };
    updateTab(path, (t) => ({ ...t, save: { status: 'saving' } }));
    try {
      const res = await api.prompt.save({
        path,
        id: tab.id,
        title: tab.title,
        tags: tab.tags,
        created: tab.created,
        extra: tab.extra,
        body: tab.body,
        hadFrontmatter: tab.hadFrontmatter,
        writeFrontmatter: tab.metaEdited,
      });
      updateTab(path, (t) => {
        // Only clear the dirty flag if nothing changed while the write was in
        // flight; otherwise the pending keystrokes still need saving.
        const unchanged = t.body === sent.body && t.title === sent.title && t.tags.join('\u0000') === sent.tags;
        return {
          ...t,
          updated: res.updated,
          hash: res.hash,
          hadFrontmatter: res.hadFrontmatter,
          dirty: unchanged ? false : t.dirty,
          diskChanged: false,
          save: { status: 'saved', at: res.updated },
        };
      });
      if (res.snapshotWritten && tabsRef.current.some((t) => t.path === path)) {
        api.history.list(tab.id).then((list) => {
          if (activeRef.current >= 0 && tabsRef.current[activeRef.current] &&
              tabsRef.current[activeRef.current].path === path) setSnapshots(list);
        });
      }
    } catch (err) {
      // Keep the buffer and the dirty flag: text is never dropped on the floor.
      updateTab(path, (t) => ({ ...t, save: { status: 'error', message: cleanError(err) } }));
    }
  }, [updateTab]);

  const scheduleSave = useCallback((path) => {
    const existing = saveTimers.current.get(path);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(path, setTimeout(() => saveNow(path), SAVE_DEBOUNCE_MS));
  }, [saveNow]);

  const flushAll = useCallback(async () => {
    const dirty = tabsRef.current.filter((t) => t.dirty).map((t) => t.path);
    await Promise.all(dirty.map((p) => saveNow(p)));
  }, [saveNow]);

  // ------------------------------------------------------- config persist

  const persistSession = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const openTabs = tabsRef.current.map((t) => ({ path: t.path, cursor: cursors.current.get(t.path) || 0 }));
      const act = activeRef.current;
      api.config.patch({
        openTabs,
        activeTab: act >= 0 && tabsRef.current[act] ? tabsRef.current[act].path : null,
      });
    }, 400);
  }, []);

  // --------------------------------------------------------------- tabs

  const makeTab = (doc, cursor) => ({
    path: doc.path,
    id: doc.id,
    title: doc.title,
    tags: doc.tags,
    created: doc.created,
    updated: doc.updated,
    body: doc.body,
    hadFrontmatter: doc.hadFrontmatter,
    extra: doc.extra,
    hash: doc.hash,
    cursor: cursor || 0,
    dirty: false,
    metaEdited: false,
    diskChanged: false,
    save: { status: 'idle' },
  });

  const openPath = useCallback(async (relPath, opts) => {
    const at = tabsRef.current.findIndex((t) => t.path === relPath);
    if (at >= 0) {
      setActive(at);
      if (opts && opts.reveal) setReveal({ ...opts.reveal, nonce: Math.random() });
      return;
    }
    try {
      const doc = await api.prompt.read(relPath);
      const cursor = (opts && opts.cursor) || 0;
      cursors.current.set(relPath, cursor);
      const nextIndex = tabsRef.current.length;
      setTabs((ts) => [...ts, makeTab(doc, cursor)]);
      setActive(nextIndex);
      if (opts && opts.reveal) setReveal({ ...opts.reveal, nonce: Math.random() });
      persistSession();
    } catch (err) {
      toast('Could not open ' + relPath + ': ' + cleanError(err), 'error');
    }
  }, [persistSession, toast]);

  const closeTab = useCallback(async (i) => {
    const tab = tabsRef.current[i];
    if (!tab) return;
    if (tab.dirty) await saveNow(tab.path);
    cursors.current.delete(tab.path);
    setTabs((ts) => ts.filter((_, k) => k !== i));
    setActive((a) => {
      if (tabsRef.current.length <= 1) return -1;
      if (i < a) return a - 1;
      if (i === a) return Math.min(a, tabsRef.current.length - 2);
      return a;
    });
    persistSession();
  }, [saveNow, persistSession]);

  const reorderTabs = useCallback((from, to) => {
    setTabs((ts) => {
      const next = ts.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setActive((a) => {
      if (a === from) return to;
      if (from < a && to >= a) return a - 1;
      if (from > a && to <= a) return a + 1;
      return a;
    });
    persistSession();
  }, [persistSession]);

  // --------------------------------------------------------- editor wiring

  const onEditorChange = useCallback((value) => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab || value === tab.body) return;
    updateTab(tab.path, (t) => ({ ...t, body: value, dirty: true, save: { status: 'idle' } }));
    scheduleSave(tab.path);
  }, [updateTab, scheduleSave]);

  const onCursor = useCallback((pos) => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    cursors.current.set(tab.path, pos);
    persistSession();
  }, [persistSession]);

  const onEditorBlur = useCallback(() => { flushAll(); }, [flushAll]);

  // ------------------------------------------------------------- startup

  useEffect(() => {
    let alive = true;
    (async () => {
      const meta = await api.vault.info();
      if (!alive) return;
      const cfg = meta.config || {};
      setInfo({ root: meta.root, name: meta.name, version: meta.version, shortcut: meta.shortcut });
      setFontSize(cfg.fontSize || 14);
      setPanelOpen(!!cfg.rightPanelOpen);
      setPanelTab(cfg.rightPanelTab || 'variables');
      setExpanded(new Set(cfg.treeExpanded || []));
      setVariableValues(cfg.variableValues || {});

      applySnapshot(await api.vault.tree());

      // Restore tabs, dropping any whose file has gone away.
      const restored = [];
      for (const t of cfg.openTabs || []) {
        try {
          const doc = await api.prompt.read(t.path);
          cursors.current.set(t.path, t.cursor || 0);
          restored.push(makeTab(doc, t.cursor || 0));
        } catch { /* file no longer exists */ }
      }
      if (!alive) return;
      setTabs(restored);
      const idx = restored.findIndex((t) => t.path === cfg.activeTab);
      setActive(restored.length ? (idx >= 0 ? idx : 0) : -1);
      setMaximized(await api.win.isMaximized());
    })();
    return () => { alive = false; };
  }, [applySnapshot]);

  // ------------------------------------------------- main process events

  useEffect(() => api.on.maximizeChanged((v) => setMaximized(v)), []);

  useEffect(() => api.on.flush(() => { flushAll().finally(() => api.flushDone()); }), [flushAll]);

  useEffect(() => api.on.menu((msg) => {
    if (msg && msg.command === 'window-blur') flushAll();
  }), [flushAll]);

  // External changes: refresh the tree and index, then reconcile open buffers.
  useEffect(() => api.on.vaultChanged((snap) => {
    applySnapshot(snap);
    const byPath = new Map(snap.index.map((e) => [e.path, e]));
    for (const tab of tabsRef.current) {
      const entry = byPath.get(tab.path);
      if (!entry || entry.hash === tab.hash) continue;
      if (tab.dirty) {
        updateTab(tab.path, (t) => ({ ...t, diskChanged: true }));
      } else {
        api.prompt.read(tab.path).then((doc) => {
          updateTab(tab.path, (t) => (t.dirty ? { ...t, diskChanged: true } : { ...makeTab(doc, cursors.current.get(t.path) || 0), save: t.save }));
        }).catch(() => {});
      }
    }
  }), [applySnapshot, updateTab]);

  // ------------------------------------------------------------- history

  useEffect(() => {
    if (!panelOpen || panelTab !== 'history' || !activeTab) { return; }
    let alive = true;
    api.history.list(activeTab.id).then((list) => { if (alive) setSnapshots(list); });
    return () => { alive = false; };
  }, [panelOpen, panelTab, activeTab && activeTab.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------------------------------------------------- persistence

  useEffect(() => { api.config.patch({ fontSize }); }, [fontSize]);
  useEffect(() => { api.config.patch({ rightPanelOpen: panelOpen, rightPanelTab: panelTab }); }, [panelOpen, panelTab]);
  useEffect(() => { api.config.patch({ treeExpanded: [...expanded] }); }, [expanded]);

  // ------------------------------------------------------------ commands

  const newPrompt = useCallback(async (dirRel) => {
    try {
      const rel = await api.prompt.create(dirRel || '', 'Untitled');
      await refresh();
      await openPath(rel);
      setPanelOpen(true);
      setPanelTab('info');
    } catch (err) {
      toast('Could not create prompt: ' + cleanError(err), 'error');
    }
  }, [refresh, openPath, toast]);

  const newFolder = useCallback(async (dirRel) => {
    try {
      const rel = await api.prompt.createFolder(dirRel || '', 'New folder');
      await refresh();
      setSidebarOpen(true);
      setExpanded((s) => new Set([...s, rel]));
      setRenaming({ path: rel, initial: 'New folder', isFolder: true });
    } catch (err) {
      toast('Could not create folder: ' + cleanError(err), 'error');
    }
  }, [refresh, toast]);

  const copyFilled = useCallback(async () => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    const values = variableValues[tab.id] || {};
    await api.clipboard.write(fillVariables(tab.body, values));
    toast('Copied with variables filled');
  }, [variableValues, toast]);

  const copyRaw = useCallback(async () => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    await api.clipboard.write(tab.body);
    toast('Copied raw');
  }, [toast]);

  const onVariableChange = useCallback((name, value) => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    setVariableValues((prev) => {
      const next = { ...prev, [tab.id]: { ...(prev[tab.id] || {}), [name]: value } };
      api.config.patch({ variableValues: next });
      return next;
    });
  }, []);

  const setTitle = useCallback((title) => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    updateTab(tab.path, (t) => ({ ...t, title, dirty: true, metaEdited: true, save: { status: 'idle' } }));
    scheduleSave(tab.path);
  }, [updateTab, scheduleSave]);

  const setTags = useCallback((tags) => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    updateTab(tab.path, (t) => ({ ...t, tags, dirty: true, metaEdited: true, save: { status: 'idle' } }));
    scheduleSave(tab.path);
  }, [updateTab, scheduleSave]);

  const deleteEntry = useCallback(async (node) => {
    try {
      const res = await api.prompt.remove(node.path);
      const openAt = tabsRef.current.findIndex((t) => t.path === node.path);
      if (openAt >= 0) {
        setTabs((ts) => ts.filter((_, k) => k !== openAt));
        setActive((a) => (tabsRef.current.length <= 1 ? -1 : Math.min(a, tabsRef.current.length - 2)));
      }
      await refresh();
      toast('Deleted ' + (node.title || node.name), null, {
        label: 'Undo',
        run: async () => {
          try {
            await api.prompt.restoreTrash(res.trashPath, node.path);
            await refresh();
          } catch (err) {
            toast('Undo failed: ' + cleanError(err), 'error');
          }
        },
      });
    } catch (err) {
      toast('Could not delete: ' + cleanError(err), 'error');
    }
  }, [refresh, toast]);

  const commitRename = useCallback(async (node, value) => {
    const wanted = String(value || '').trim();
    setRenaming(null);
    if (!wanted || wanted === (node.type === 'folder' ? node.name : node.title)) return;
    try {
      if (node.type !== 'folder') await saveNow(node.path);
      const rel = await api.prompt.rename(node.path, wanted, node.type === 'folder');
      await refresh();
      if (node.type === 'folder') return;
      const openAt = tabsRef.current.findIndex((t) => t.path === node.path);
      if (openAt >= 0) {
        const doc = await api.prompt.read(rel);
        cursors.current.set(rel, cursors.current.get(node.path) || 0);
        cursors.current.delete(node.path);
        setTabs((ts) => ts.map((t, k) => (k === openAt ? makeTab(doc, cursors.current.get(rel) || 0) : t)));
        persistSession();
      }
    } catch (err) {
      toast('Rename failed: ' + cleanError(err), 'error');
    }
  }, [refresh, saveNow, persistSession, toast]);

  const moveEntry = useCallback(async (from, destDir) => {
    try {
      const rel = await api.prompt.move(from, destDir);
      await refresh();
      const openAt = tabsRef.current.findIndex((t) => t.path === from);
      if (openAt >= 0 && rel !== from) {
        const doc = await api.prompt.read(rel);
        cursors.current.set(rel, cursors.current.get(from) || 0);
        cursors.current.delete(from);
        setTabs((ts) => ts.map((t, k) => (k === openAt ? makeTab(doc, cursors.current.get(rel) || 0) : t)));
        persistSession();
      }
    } catch (err) {
      toast('Move failed: ' + cleanError(err), 'error');
    }
  }, [refresh, persistSession, toast]);

  const restoreSnapshot = useCallback(async (snap) => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    try {
      await saveNow(tab.path);
      const doc = await api.history.restore(tab.path, tab.id, snap.file);
      setTabs((ts) => ts.map((t) => (t.path === tab.path ? makeTab(doc, cursors.current.get(t.path) || 0) : t)));
      setSnapshots(await api.history.list(tab.id));
      await refresh();
      toast('Restored version');
    } catch (err) {
      toast('Restore failed: ' + cleanError(err), 'error');
    }
  }, [saveNow, refresh, toast]);

  const reloadFromDisk = useCallback(async () => {
    const tab = tabsRef.current[activeRef.current];
    if (!tab) return;
    const doc = await api.prompt.read(tab.path);
    setTabs((ts) => ts.map((t) => (t.path === tab.path ? makeTab(doc, cursors.current.get(t.path) || 0) : t)));
  }, []);

  // ------------------------------------------------------------ shortcuts

  const closeOverlays = useCallback(() => {
    if (ctxMenu) { setCtxMenu(null); return true; }
    if (settingsOpen) { setSettingsOpen(false); return true; }
    if (quickOpen) { setQuickOpen(false); return true; }
    if (ftsOpen) { setFtsOpen(false); return true; }
    if (sidebarOpen) { setSidebarOpen(false); return true; }
    if (panelOpen) { setPanelOpen(false); return true; }
    return false;
  }, [ctxMenu, settingsOpen, quickOpen, ftsOpen, sidebarOpen, panelOpen]);

  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') { if (closeOverlays()) e.preventDefault(); return; }
      if (!ctrl) return;
      const k = e.key.toLowerCase();

      if (k === 'p' && !e.shiftKey) { e.preventDefault(); setFtsOpen(false); setQuickOpen(true); return; }
      if (k === 'f' && e.shiftKey) { e.preventDefault(); setQuickOpen(false); setFtsOpen(true); return; }
      if (k === 'n' && !e.shiftKey) { e.preventDefault(); newPrompt(''); return; }
      if (k === 'n' && e.shiftKey) { e.preventDefault(); newFolder(''); return; }
      if (k === 'w') { e.preventDefault(); if (activeRef.current >= 0) closeTab(activeRef.current); return; }
      if (k === 'b') { e.preventDefault(); setSidebarOpen((v) => !v); return; }
      if (k === 'j') { e.preventDefault(); setPanelOpen((v) => !v); return; }
      if (k === 'c' && e.shiftKey) { e.preventDefault(); copyFilled(); return; }
      if (k === 'v' && e.shiftKey) { e.preventDefault(); copyRaw(); return; }
      if (k === 's' && !e.shiftKey) {
        e.preventDefault();
        const t = tabsRef.current[activeRef.current];
        if (t) saveNow(t.path);           // muscle memory, no dialog, no fuss
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const n = tabsRef.current.length;
        if (!n) return;
        setActive((a) => (e.shiftKey ? (a - 1 + n) % n : (a + 1) % n));
        return;
      }
      if (k === '=' || k === '+') { e.preventDefault(); setFontSize((s) => Math.min(28, s + 1)); return; }
      if (k === '-' || k === '_') { e.preventDefault(); setFontSize((s) => Math.max(9, s - 1)); return; }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const i = Number(e.key) - 1;
        if (i < tabsRef.current.length) setActive(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOverlays, newPrompt, newFolder, closeTab, copyFilled, copyRaw, saveNow]);

  useEffect(() => { persistSession(); }, [active, persistSession]);

  // --------------------------------------------------------- filtered tree

  const filteredTree = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q && selectedTags.length === 0) return tree;
    const keep = (node) => {
      if (node.type === 'folder') {
        const children = node.children.map(keep).filter(Boolean);
        return children.length ? { ...node, children } : null;
      }
      const matchesText = !q || node.title.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      const matchesTags = selectedTags.every((t) => (node.tags || []).includes(t));
      return matchesText && matchesTags ? node : null;
    };
    return tree.map(keep).filter(Boolean);
  }, [tree, filter, selectedTags]);

  const filterActive = !!filter.trim() || selectedTags.length > 0;

  // While filtering, show everything that survived the filter.
  const effectiveExpanded = useMemo(() => {
    if (!filterActive) return expanded;
    const all = new Set();
    const walk = (nodes) => nodes.forEach((n) => {
      if (n.type === 'folder') { all.add(n.path); walk(n.children); }
    });
    walk(filteredTree);
    return all;
  }, [filterActive, expanded, filteredTree]);

  // ------------------------------------------------------- context menu

  const openContextMenu = useCallback((e, node) => {
    const parentDir = node
      ? (node.type === 'folder' ? node.path : node.path.split('/').slice(0, -1).join('/'))
      : '';
    const items = [
      { label: 'New prompt', run: () => newPrompt(parentDir) },
      { label: 'New folder', run: () => newFolder(parentDir) },
    ];
    if (node) {
      items.push({ sep: true });
      items.push({ label: 'Rename', run: () => setRenaming({ path: node.path, initial: node.type === 'folder' ? node.name : node.title, isFolder: node.type === 'folder' }) });
      if (node.type === 'file') items.push({ label: 'Duplicate', run: async () => { await api.prompt.duplicate(node.path); await refresh(); } });
      items.push({ label: 'Reveal in Explorer', run: () => api.vault.reveal(node.path) });
      items.push({ sep: true });
      items.push({ label: 'Delete', run: () => deleteEntry(node) });
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [newPrompt, newFolder, refresh, deleteEntry]);

  // ------------------------------------------------------------- render

  return (
    <div className="app">
      <TitleBar
        tabs={tabs}
        activeIndex={active}
        maximized={maximized}
        sidebarOpen={sidebarOpen}
        panelOpen={panelOpen}
        onSelect={setActive}
        onClose={closeTab}
        onReorder={reorderTabs}
        onNew={() => newPrompt('')}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onMinimize={() => api.win.minimize()}
        onToggleMaximize={() => api.win.toggleMaximize()}
        onCloseWindow={() => api.win.close()}
      />

      <div className="body-row">
        <div className="editor-area">
          {activeTab ? (
            <Editor
              key={activeTab.path}
              tab={activeTab}
              fontSize={fontSize}
              onChange={onEditorChange}
              onCursor={onCursor}
              onBlur={onEditorBlur}
              reveal={reveal}
              onRevealDone={() => setReveal(null)}
            />
          ) : (
            <div className="empty-state">
              <div>Nothing open.</div>
              <div><kbd>Ctrl</kbd> <kbd>P</kbd> to find a prompt, <kbd>Ctrl</kbd> <kbd>N</kbd> for a new one.</div>
            </div>
          )}

          {sidebarOpen && (
            <>
              <div className="scrim" onMouseDown={() => setSidebarOpen(false)} />
              <Sidebar
                vaultName={info.name}
                nodes={filteredTree}
                activePath={activeTab ? activeTab.path : null}
                expanded={effectiveExpanded}
                filter={filter}
                tags={tagList}
                selectedTags={selectedTags}
                onFilter={setFilter}
                onToggleTag={(t) => setSelectedTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}
                onToggleFolder={(p) => setExpanded((s) => {
                  const next = new Set(s);
                  if (next.has(p)) next.delete(p); else next.add(p);
                  return next;
                })}
                onOpen={(p) => openPath(p)}
                onContextMenu={openContextMenu}
                onNew={() => newPrompt('')}
                onNewFolder={() => newFolder('')}
                onSettings={() => setSettingsOpen(true)}
                renaming={renaming}
                onCommitRename={commitRename}
                onCancelRename={() => setRenaming(null)}
                onMove={moveEntry}
                onRootDrop={(from) => moveEntry(from, '')}
              />
            </>
          )}
        </div>

        {panelOpen && (
          <RightPanel
            active={panelTab}
            onSelect={setPanelTab}
            tab={activeTab}
            variableValues={(activeTab && variableValues[activeTab.id]) || {}}
            onVariableChange={onVariableChange}
            onCopyFilled={copyFilled}
            onCopyRaw={copyRaw}
            snapshots={snapshots}
            onReloadHistory={async () => { if (activeTab) setSnapshots(await api.history.list(activeTab.id)); }}
            onRestore={restoreSnapshot}
            api={api}
            toast={toast}
            allTags={allTagNames}
            onTitle={setTitle}
            onTags={setTags}
            onReveal={() => activeTab && api.vault.reveal(activeTab.path)}
          />
        )}
      </div>

      <StatusBar tab={activeTab} onReloadFromDisk={reloadFromDisk} />

      {quickOpen && (
        <QuickOpen
          entries={index}
          onPick={(p) => { setQuickOpen(false); openPath(p); }}
          onClose={() => setQuickOpen(false)}
        />
      )}

      {ftsOpen && (
        <FullTextSearch
          api={api}
          onPick={(p, match) => { setFtsOpen(false); openPath(p, { reveal: { line: match.line, col: match.col } }); }}
          onClose={() => setFtsOpen(false)}
        />
      )}

      {settingsOpen && (
        <Settings
          api={api}
          info={{ root: info.root, version: info.version, count: index.length }}
          shortcut={info.shortcut}
          onVaultChanged={(snap) => {
            applySnapshot(snap);
            setTabs([]);
            setActive(-1);
            setInfo((v) => ({ ...v, root: snap.root, name: snap.root.split(/[\\/]/).pop() }));
          }}
          onClose={() => setSettingsOpen(false)}
          toast={toast}
        />
      )}

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
