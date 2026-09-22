# Stash

A desktop editor for LLM prompts, in the spirit of Sublime Text but built for
one job. Prompts are plain Markdown files in a folder you own. Single user,
offline, no accounts, no telemetry, no network calls of any kind.

Autosave with no save dialog, tabs, a file tree, tags, fuzzy quick open, full
text search, version history, `{{variables}}`, and a global quick capture
shortcut that works anywhere in Windows.

## Run it

```sh
npm install
npm run dev        # Vite dev server + Electron
npm run dist       # Windows installer in release/
```

If the window never appears, npm may have blocked Electron's install script:
run `node node_modules/electron/install.js` once, then try again.

`npm run build` builds the renderer and preload; `npm start` builds and launches.

## Your prompts

They live in a `Stash` folder inside your Documents folder, created on first
run. Change it from the sidebar (Ctrl+B) gear: **Change vault folder...**

To use the same prompts on two machines, put the vault in a folder that already
syncs (OneDrive, Google Drive, Dropbox, a git repo) and set that folder on each
machine. Mark it available offline, since Stash reads every prompt at startup.
Open tabs, cursor positions and remembered variable values stay per machine.
Don't edit the same prompt on both at once; the sync client resolves that by
leaving a second copy in the folder.

One prompt is one file:

```markdown
---
id: 01JQ8F3K2M9XZ
title: Code review - security pass
tags: [coding, review, security]
created: 2026-09-22T10:04:11.000Z
updated: 2026-09-22T14:31:02.000Z
---

You are reviewing {{language}} code for security issues.

Focus on: {{focus|injection, auth, secrets}}
```

The `id` never changes, so history survives renames and moves. The filename is
derived from the title; the frontmatter title is what you see. A file with no
frontmatter is left alone until you edit its title or tags.

Stash's own bookkeeping sits in `<vault>/.stash/` (version snapshots and trash)
and is never shown in the tree. Deleting a prompt moves it to the trash behind
an undo toast; nothing is unlinked by the app.

## Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+P | Quick open (fuzzy) |
| Ctrl+Shift+F | Full text search |
| Ctrl+N / Ctrl+Shift+N | New prompt / folder |
| Ctrl+W | Close tab |
| Ctrl+Tab / Ctrl+1..9 | Cycle / jump to tab |
| Ctrl+B / Ctrl+J | Sidebar / right panel |
| Ctrl+Shift+C / Ctrl+Shift+V | Copy filled / copy raw |
| Ctrl+F | Find in prompt |
| Ctrl+S | Save now (it already saved) |
| Ctrl+= / Ctrl+- | Editor font size |
| Ctrl+Alt+S | Quick capture, system wide |
| Esc | Dismiss whatever is open |

Middle-click a tab to close it, drag tabs to reorder, drag a prompt onto a
folder to move it. Closing the window parks Stash in the tray; only tray Quit
exits.

## Source

`electron/` is the main process: window and tray, IPC (channel names all live in
`channels.cjs`), and every filesystem operation, including the path containment
check and the atomic write. `src/` is the React + CodeMirror 6 renderer.

`NOTES.md` has what was deliberately simplified, what I'm unsure about, and what
was verified against the running app.
