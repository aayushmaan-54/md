import { Compartment, EditorState } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

export type TabWidthOption = 2 | 4 | 8 | "tab";

export const tabWidthCompartment = new Compartment();

export function tabWidthExtension(option: TabWidthOption): Extension {
  const unit = option === "tab" ? "\t" : " ".repeat(option);
  const size = option === "tab" ? 8 : option;
  return [indentUnit.of(unit), EditorState.tabSize.of(size)];
}
