import { useCallback, useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView, keymap } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { search, searchKeymap } from '@codemirror/search';
import { stashTheme, markdownHighlight, variableHighlighter, variableTheme } from '../lib/editorSetup.js';

/**
 * One CodeMirror per active tab. The component is keyed on the tab path by the
 * caller, so switching tabs mounts a fresh editor; the saved cursor (or a
 * pending "jump to this search hit") is applied as the initial position.
 */
export default function Editor({ tab, fontSize, onChange, onCursor, onBlur, reveal, onRevealDone }) {
  const viewRef = useRef(null);
  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: [] }),
    markdownHighlight,
    variableHighlighter,
    variableTheme,
    EditorView.lineWrapping,
    search({ top: false }),
    keymap.of(searchKeymap),
    EditorView.domEventHandlers({ blur: () => { onBlur(); return false; } }),
  ], [onBlur]);

  const theme = useMemo(() => stashTheme(fontSize), [fontSize]);

  const moveTo = (view, pos) => {
    const at = Math.max(0, Math.min(pos, view.state.doc.length));
    view.dispatch({
      selection: EditorSelection.single(at),
      effects: EditorView.scrollIntoView(at, { y: 'center' }),
    });
    view.focus();
  };

  const posOfMatch = (view, rv) => {
    const lineNo = Math.min(Math.max(1, rv.line + 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNo);
    return Math.min(line.from + (rv.col || 0), line.to);
  };

  // The view can be created either before or after our reveal effect runs, so
  // both paths handle a pending reveal and whichever happens first wins.
  const handleCreate = useCallback((view) => {
    viewRef.current = view;
    const rv = revealRef.current;
    if (rv) {
      moveTo(view, posOfMatch(view, rv));
      onRevealDone();
    } else {
      moveTo(view, tab.cursor || 0);
    }
  }, [tab.path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !reveal) return;
    moveTo(view, posOfMatch(view, reveal));
    onRevealDone();
  }, [reveal, onRevealDone]);

  return (
    <div className="editor-host">
      <CodeMirror
        value={tab.body}
        height="100%"
        theme={theme}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: false,
          closeBrackets: false,
          autocompletion: false,
          searchKeymap: false,
          highlightSelectionMatches: true,
          tabSize: 2,
        }}
        onCreateEditor={handleCreate}
        onChange={onChange}
        onUpdate={(update) => {
          if (update.selectionSet || update.docChanged) {
            onCursor(update.state.selection.main.head);
          }
        }}
      />
    </div>
  );
}
