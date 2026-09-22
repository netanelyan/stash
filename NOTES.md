# Notes

Things I simplified, decided one way rather than another, or am not sure about.
Nothing here is a feature request I took on myself; the spec was built as
written.

## Deliberate simplifications

- **Switching tabs remounts the editor.** Each tab's CodeMirror instance is
  keyed on the file path, so moving to another tab and back gives you a fresh
  editor at the saved cursor position but an empty undo stack. Keeping one
  `EditorState` per tab would fix it; it wasn't worth the machinery for a
  single-user editor.
- **Editing the title in the Info panel does not rename the file.** It only
  updates frontmatter. Renaming (and therefore reslugging the filename) happens
  when you rename from the tree, which is also where you'd expect it. Renaming
  the file on every keystroke of a title edit would be awful.
- **External renames leave the open tab pointing at the old path.** The tree and
  index update immediately and nothing crashes, but the tab keeps its buffer,
  and saving it would recreate a file at the old path. On the next restart the
  tab is quietly dropped because its file is gone. Following a file across an
  external rename would mean matching on `id`, which felt like more magic than
  this deserves.
- **Files with no frontmatter get a path-derived id** (`f` + a hash of the
  relative path) so history has something to key on before a real `id` exists.
  Move such a file and its history no longer follows it. As soon as you edit the
  title or tags, a proper frontmatter block with a real id is written and the
  problem goes away.
- **External changes trigger a full vault rescan**, debounced 300ms, with a
  guard so Stash's own writes don't trigger one. That's a directory walk plus a
  read of every `.md` file. Fine for a few thousand prompts on an SSD; a much
  larger vault would want incremental index updates keyed on the changed paths.
- **Snapshots record the state after a save**, which is how the spec reads.
  Restore snapshots the current content first (forced, ignoring the 60s
  throttle), so restore is undoable. History diffs compare bodies only, since
  the `updated` timestamp in frontmatter changes on every save and would
  otherwise dominate every diff.
- **The diff is line-level LCS**, no word-level highlighting inside a changed
  line, and unchanged runs longer than 3 lines collapse to "N unchanged lines".
- **Full text search is a plain case-insensitive substring scan** over the
  in-memory index: no regex, no word boundaries, capped at 20 matches per file
  and 300 files. Quick open is where the clever matching lives.
- **The variable syntax is deliberately dumb**: `{{name}}` or
  `{{name|default}}`, where the name may not contain `{`, `}` or `|` and the
  default may not contain `{` or `}`. No nesting, no escaping.
- **The preload is bundled by Vite** into `dist-electron/preload.js`. A
  sandboxed preload can only `require` Electron and a few Node builtins, not a
  relative file, and I wanted the channel names to stay in one shared module
  (`electron/channels.cjs`) rather than be duplicated by hand.
- **The dev launcher is 40 lines of `scripts/dev.cjs`** instead of
  `concurrently` + `wait-on`. Same for the icon generator, which writes a real
  `.ico` with nothing but `zlib`.
- **JetBrains Mono is vendored** as two woff2 files in `src/assets/fonts`,
  copied out of `@fontsource/jetbrains-mono` at build-setup time; the package
  itself is not a dependency. Nothing is fetched at runtime.
- **The app icon is a generated placeholder** (a blue "S" on the chrome grey).
  Replace `build/icon.ico` with a real one whenever you have one.
- **The quick capture window closes when it loses focus.** Clicking away is
  treated as "not now" rather than leaving a stray always-on-top window around.
  Esc does the same, Ctrl+Enter (or Enter from the title field) saves.
- **No tests.** The verification I did was by driving the real app (see below).

## Things I am less sure about

- **Syncing the vault is left entirely to the folder.** Stash has no merge, no
  conflict resolution and no awareness of a sync client; if OneDrive or Dropbox
  drops a conflict copy into the vault, it simply appears as another prompt.
  That is the honest consequence of "prompts are just files", but it means
  editing the same prompt on two machines at once can strand an edit in a second
  file.
- **`fs.watch` with `{ recursive: true }`** is solid on a local NTFS folder. On
  a network share, or a folder aggressively synced by OneDrive or Dropbox, it
  can miss events or fire storms of them. If that bites, the fallback is a
  periodic rescan; I did not add one speculatively.
- **The 1500ms flush timeout on window close.** If the renderer were wedged mid
  save, the window would hide (or the app quit) anyway after 1.5s. In practice
  the debounced write is a few milliseconds, but the number is a guess.
- **Ctrl+Tab is handled by the app**, in document order of the tab strip, not as
  a most-recently-used stack. Some people expect MRU.
- **Per-tab cursor positions are stored as character offsets.** If a file is
  edited outside Stash while a tab is open, the restored cursor can land
  somewhere arbitrary. Restoring by line felt worse for prompts, which are often
  one long paragraph.
- **The tab strip does not scroll to reveal the active tab** when you jump to a
  tab that has been scrolled out of view with many tabs open.
- **Deleting a folder** moves the whole folder to `.stash/trash` and the undo
  toast restores it. Trash is never emptied automatically, by design, but that
  means it grows forever until you clear it yourself.
- **`config.json` is written from the main process with a debounce**, so a hard
  kill within ~250ms of a layout change can lose that one change (never prompt
  text, which goes through the atomic write path).

## What I verified, and how

Driven against the real app on Windows 11 (Electron 44.4.3, Node 26), by
sending real keyboard and mouse input to the window and checking the resulting
files on disk.

Verified:

- `npm install` completes clean (with the Electron binary caveat in the README).
- `npm run build` completes with no errors or unresolved imports.
- The app launches and opens a window.
- Ctrl+N, typing, one second later the `.md` file on disk holds the text with
  correct frontmatter and a refreshed `updated`.
- Killing the process mid-typing (`taskkill /F` during a burst of keystrokes)
  left every file parseable, no zero-byte files and no leftover `.tmp` files.
- Four prompts open, restart, tabs and the active tab came back with cursor
  positions intact (verified down to the caret landing on the right line and
  column).
- `{{language}}` filled in from the Variables panel: Ctrl+Shift+C put the
  substituted text on the clipboard, Ctrl+Shift+V the raw text. Values survived
  a restart.
- Two snapshots more than 60 seconds apart, and the throttle held during a burst
  of saves in between. The diff renders with the added line in green.
- Minimized the window, pressed Ctrl+Alt+S, the capture window appeared and
  saved into `Inbox`.
- Renamed a file in Explorer with Stash open: tree and index updated, no crash.
- Closing the window keeps Stash alive in the tray, and text typed 120ms before
  the close was flushed to disk by the close handler.
- Quick open (subsequence matching, highlighted characters), full text search
  (grouped, clicking a result scrolls to the line), tag filtering, inline
  rename, delete with an undo toast, drag a prompt onto a folder, drag a tab to
  reorder, the styled Ctrl+F panel, Ctrl+= font size, Ctrl+Tab, the Settings
  modal.
- Restoring a snapshot from the History panel: the body reverted, `id` and
  `created` were preserved, and a snapshot of the pre-restore state was written
  first, so the restore itself is undoable.
- `npm run dist` produced `release/Stash Setup 1.0.0.exe` (113MB); it installed
  per-user to `%LOCALAPPDATA%\Programs\Stash` with a Start menu and desktop
  shortcut, and the installed build launched and opened the same vault.

Not verified:

- Behaviour on any machine but this one, or any Windows version but 11.
- A vault with thousands of prompts: everything here was exercised with a
  handful of files, so "fast enough to feel instant on a few thousand files" is
  an expectation from how the code is written, not a measurement.
- The 200-snapshot cap actually pruning (the throttle makes that slow to reach
  honestly, and I did not want to fake the timestamps).
- Multi-monitor and high-DPI scaling of the frameless window.
