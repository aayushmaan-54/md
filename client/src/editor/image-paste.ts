import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { insertPastedImage } from "../images/insert";

export function imagePaste(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      const imageItem = Array.from(items).find((item) =>
        item.type.startsWith("image/"),
      );
      const file = imageItem?.getAsFile();
      if (!file) return false;

      event.preventDefault();
      void insertPastedImage(view, file);
      return true;
    },
  });
}
