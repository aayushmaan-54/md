import { EditorSelection } from "@codemirror/state";
import type { Command } from "@codemirror/view";

// Wraps the selection in `mark` on both sides (or inserts `mark+placeholder
// +mark` with the placeholder selected, if nothing is selected), as a
// single undo step.
function wrapCommand(mark: string, placeholder: string): Command {
  return (view) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const text = range.empty
          ? placeholder
          : view.state.sliceDoc(range.from, range.to);
        const innerFrom = range.from + mark.length;
        return {
          changes: {
            from: range.from,
            to: range.to,
            insert: `${mark}${text}${mark}`,
          },
          range: EditorSelection.range(innerFrom, innerFrom + text.length),
        };
      }),
    );
    return true;
  };
}

export const toggleBold = wrapCommand("**", "bold text");
export const toggleItalic = wrapCommand("_", "italic text");
export const toggleInlineCode = wrapCommand("`", "code");

// Inserts `[selection](url)` (or `[link text](url)` with nothing selected)
// and selects "url" so it can be typed over immediately.
export const insertLink: Command = (view) => {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = range.empty
        ? "link text"
        : view.state.sliceDoc(range.from, range.to);
      const urlFrom = range.from + 1 + text.length + 2;
      return {
        changes: { from: range.from, to: range.to, insert: `[${text}](url)` },
        range: EditorSelection.range(urlFrom, urlFrom + 3),
      };
    }),
  );
  return true;
};

export const leaveEditor: Command = (view) => {
  view.contentDOM.blur();
  return true;
};
