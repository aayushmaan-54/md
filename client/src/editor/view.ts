import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createEditorExtensions } from "./setup";
import type { EditorSetupOptions } from "./setup";
import { reconfigureSyntaxTheme } from "./highlight";
import { tabWidthCompartment, tabWidthExtension } from "./tab-width";
import type { TabWidthOption } from "./tab-width";

export function createEditorView(
  parent: HTMLElement,
  doc: string,
  options: EditorSetupOptions,
): EditorView {
  const state = EditorState.create({
    doc,
    extensions: createEditorExtensions(options),
  });

  return new EditorView({ state, parent });
}

export function setTabWidth(view: EditorView, option: TabWidthOption) {
  view.dispatch({
    effects: tabWidthCompartment.reconfigure(tabWidthExtension(option)),
  });
}

// Reconfigures syntax colors in place, without a fresh EditorState.
export function setSyntaxTheme(view: EditorView, theme: string) {
  view.dispatch({ effects: reconfigureSyntaxTheme(theme) });
}

// Switching notes must not be a transaction on the shared state — history
// is per-state, so a plain dispatch({changes: ...}) would put "switch to
// this note" on the SAME undo stack as the note's own edits. Undo could
// then revert the switch itself, leaving the visible content out of sync
// with which note is actually active. A fresh state per note gives each
// note its own (reset) undo history instead, which is the accepted
// tradeoff — see the README's sync limitations.
export function loadNoteState(
  view: EditorView,
  doc: string,
  options: EditorSetupOptions,
): void {
  view.setState(
    EditorState.create({ doc, extensions: createEditorExtensions(options) }),
  );
}
