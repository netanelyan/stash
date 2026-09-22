import { EditorView, Decoration, ViewPlugin, MatchDecorator } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { VAR_RE } from './variables.js';

// The palette, duplicated here because CodeMirror themes want literal values.
// Keep in sync with src/styles/index.css.
const C = {
  bg: '#1e1e1e',
  bgChrome: '#252526',
  bgElevated: '#2d2d30',
  border: '#333333',
  text: '#cccccc',
  textDim: '#858585',
  accent: '#569cd6',
  accentSoft: 'rgba(86,156,214,0.15)',
};

export function stashTheme(fontSize) {
  return EditorView.theme(
    {
      '&': {
        color: C.text,
        backgroundColor: C.bg,
        height: '100%',
        fontSize: fontSize + 'px',
      },
      '.cm-scroller': {
        fontFamily: "'JetBrains Mono', 'Cascadia Mono', Consolas, monospace",
        lineHeight: '1.6',
        overflowY: 'auto',
      },
      '.cm-content': {
        padding: '12px 24px 40vh 24px',
        caretColor: C.accent,
      },
      '.cm-line': { padding: '0' },
      '.cm-gutters': {
        backgroundColor: C.bg,
        color: C.textDim,
        border: 'none',          // no gutter border: the numbers just sit there
        paddingLeft: '8px',
      },
      '.cm-lineNumbers .cm-gutterElement': { color: '#5a5a5a', minWidth: '28px' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: C.textDim },
      '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
      '&.cm-focused': { outline: 'none' },
      '&.cm-focused .cm-cursor, .cm-cursor': {
        borderLeftColor: C.accent,
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: C.accentSoft,
      },
      '.cm-selectionMatch': { backgroundColor: 'rgba(86,156,214,0.10)' },
      '.cm-searchMatch': { backgroundColor: 'rgba(86,156,214,0.22)', outline: '1px solid ' + C.accent },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(86,156,214,0.40)' },

      // Ctrl+F panel, restyled to match the app rather than CodeMirror's default
      '.cm-panels': { backgroundColor: C.bgChrome, color: C.text, border: 'none' },
      '.cm-panels.cm-panels-bottom': { borderTop: '1px solid ' + C.border },
      '.cm-panel.cm-search': {
        padding: '6px 10px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '12px',
      },
      '.cm-panel.cm-search label': { color: C.textDim, fontSize: '11px' },
      '.cm-textfield': {
        backgroundColor: C.bgElevated,
        color: C.text,
        border: '1px solid ' + C.border,
        borderRadius: '3px',
        padding: '3px 6px',
        fontSize: '12px',
      },
      '.cm-textfield:focus': { outline: 'none', borderColor: C.accent },
      '.cm-button': {
        backgroundColor: C.bgElevated,
        backgroundImage: 'none',
        color: C.text,
        border: '1px solid ' + C.border,
        borderRadius: '3px',
        padding: '2px 8px',
        fontSize: '12px',
      },
      '.cm-button:hover': { backgroundColor: '#37373d' },
      '.cm-panel.cm-search [name=close]': {
        color: C.textDim,
        fontSize: '16px',
        padding: '0 6px',
        cursor: 'pointer',
      },
      '.cm-tooltip': {
        backgroundColor: C.bgElevated,
        border: '1px solid ' + C.border,
        color: C.text,
      },
    },
    { dark: true }
  );
}

// Restrained markdown highlighting: headings a little brighter and bolder,
// code in a faint box, links in the accent. Nothing rainbow.
export const markdownHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading1, color: '#e6e6e6', fontWeight: '700', fontSize: '1.15em' },
    { tag: t.heading2, color: '#e0e0e0', fontWeight: '700', fontSize: '1.08em' },
    { tag: [t.heading3, t.heading4, t.heading5, t.heading6], color: '#dcdcdc', fontWeight: '600' },
    { tag: t.strong, color: '#dcdcdc', fontWeight: '700' },
    { tag: t.emphasis, color: '#dcdcdc', fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: C.textDim },
    { tag: t.link, color: C.accent, textDecoration: 'underline' },
    { tag: t.url, color: C.accent },
    { tag: t.monospace, color: '#ce9178', backgroundColor: 'rgba(255,255,255,0.05)' },
    { tag: t.quote, color: '#9cb98a', fontStyle: 'italic' },
    { tag: t.list, color: C.accent },
    { tag: t.processingInstruction, color: C.textDim },
    { tag: t.meta, color: C.textDim },
    { tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
  ])
);

// {{variable}} gets a soft accent background so it is visible while writing.
const variableMark = Decoration.mark({ class: 'cm-stash-variable' });
const variableMatcher = new MatchDecorator({
  regexp: new RegExp(VAR_RE.source, 'g'),
  decoration: () => variableMark,
});

export const variableHighlighter = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = variableMatcher.createDeco(view);
    }
    update(update) {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

export const variableTheme = EditorView.baseTheme({
  '.cm-stash-variable': {
    backgroundColor: 'rgba(86,156,214,0.15)',
    borderRadius: '2px',
  },
});
