import { Prec } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  copyLineDown,
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  moveLineDown,
  moveLineUp,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxThemeExtension } from "./highlight";
import { tabWidthCompartment, tabWidthExtension } from "./tab-width";
import type { TabWidthOption } from "./tab-width";
import { toggleTaskLine } from "./task-toggle";
import { autoSurround } from "./surround";
import { imagePaste } from "./image-paste";
import {
  insertLink,
  leaveEditor,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
} from "./formatting";

export type EditorSetupOptions = {
  tabWidth: TabWidthOption;
  onChange: (doc: string) => void;
};

// defaultKeymap binds plain Alt-ArrowUp/Down to moveLineUp/moveLineDown,
// which the README doesn't ask for (it uses Alt-Shift-Arrow for that, see
// below) and which would otherwise swallow the app-level "previous/next
// file" shortcut (plain Alt-Arrow) before it ever reaches the document
// listener in editor-view.ts.
const appKeymap = defaultKeymap.filter(
  (binding) => binding.key !== "Alt-ArrowUp" && binding.key !== "Alt-ArrowDown",
);

// `markdown()` already installs, by default: Enter -> continue the current
// list/blockquote marker (insertNewlineContinueMarkup), Backspace -> unwind
// one level of list/blockquote markup, and a paste handler that turns a URL
// pasted over a selection into a link. That covers "smart lists" and
// "smart paste" for free — see markdownKeymap / pasteURLAsLink upstream.
export function createEditorExtensions(options: EditorSetupOptions): Extension[] {
  return [
    history(),
    EditorView.lineWrapping,
    syntaxThemeExtension(document.documentElement.dataset.theme ?? "sage"),
    markdown({ codeLanguages: languages }),
    tabWidthCompartment.of(tabWidthExtension(options.tabWidth)),
    autoSurround(),
    // Highest precedence so an image-file paste is claimed before
    // lang-markdown's own paste handler (pasteURLAsLink, text-only) sees it.
    Prec.highest(imagePaste()),
    Prec.highest(
      keymap.of([
        { key: "Mod-Enter", run: toggleTaskLine },
        { key: "Alt-Shift-ArrowUp", run: moveLineUp },
        { key: "Alt-Shift-ArrowDown", run: moveLineDown },
        { key: "Alt-Shift-d", run: copyLineDown },
        { key: "Mod-b", run: toggleBold },
        { key: "Mod-i", run: toggleItalic },
        { key: "Mod-e", run: toggleInlineCode },
        { key: "Mod-Shift-l", run: insertLink },
        { key: "Escape", run: leaveEditor },
      ]),
    ),
    keymap.of([indentWithTab, ...historyKeymap, ...appKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
    }),
  ];
}
