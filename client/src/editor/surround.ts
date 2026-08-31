import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

// Selecting text and pressing one of these wraps the selection instead of
// replacing it. Only fires when the selection is non-empty — with no
// selection these keys just insert themselves normally.
const SURROUND_PAIRS: Record<string, [string, string]> = {
  "(": ["(", ")"],
  "[": ["[", "]"],
  "{": ["{", "}"],
  '"': ['"', '"'],
  "'": ["'", "'"],
  "`": ["`", "`"],
  "*": ["*", "*"],
  _: ["_", "_"],
  "~": ["~", "~"],
};

export function autoSurround(): Extension {
  return EditorView.domEventHandlers({
    keydown(event, view) {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
        return false;

      const pair = SURROUND_PAIRS[event.key];
      if (!pair) return false;

      const hasSelection = view.state.selection.ranges.some((r) => !r.empty);
      if (!hasSelection) return false;

      const [open, close] = pair;

      view.dispatch(
        view.state.changeByRange((range) => {
          if (range.empty) return { range };

          const text = view.state.sliceDoc(range.from, range.to);
          return {
            changes: {
              from: range.from,
              to: range.to,
              insert: `${open}${text}${close}`,
            },
            range: EditorSelection.range(
              range.from + open.length,
              range.from + open.length + text.length,
            ),
          };
        }),
      );

      event.preventDefault();
      return true;
    },
  });
}
