import { Compartment, type Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { isDarkTheme } from "../lib/appearance";
import { darkSyntaxColors, lightSyntaxColors } from "./syntax-colors.generated";

// Colors come from syntax-colors.generated.ts (see scripts/generate-syntax-colors.mjs).
function buildHighlightStyle(colors: Record<string, string>): HighlightStyle {
  return HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment], color: colors.comment, fontStyle: "italic" },
    { tag: t.keyword, color: colors.keyword },
    { tag: [t.string, t.special(t.string), t.character, t.regexp], color: colors.string },
    { tag: [t.number, t.bool, t.null, t.atom], color: colors.constant },
    { tag: [t.className, t.typeName], color: colors.entity },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: colors.entity },
    { tag: [t.propertyName, t.attributeName], color: colors.support },
    { tag: t.tagName, color: colors["entity.name.tag"] },
    { tag: t.variableName, color: colors["variable.other"] },
    {
      tag: [t.operator, t.derefOperator, t.punctuation, t.bracket, t.separator],
      color: colors["variable.other"],
    },
    { tag: t.invalid, color: colors["invalid.illegal"] },
    { tag: t.heading, fontWeight: "600", color: colors["markup.heading"] },
    { tag: t.strong, fontWeight: "700", color: colors["markup.bold"] },
    { tag: t.emphasis, fontStyle: "italic", color: colors["markup.italic"] },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, textDecoration: "underline", color: colors["string.other.link"] },
    { tag: t.url, color: colors["string.other.link"] },
    { tag: t.monospace, color: colors["markup.inline.raw"] },
    // Markdown marker characters (#, list bullets, >, ``` , [](), *_~, |).
    { tag: t.processingInstruction, color: colors.comment },
    { tag: t.contentSeparator, color: colors.comment },
    { tag: t.escape, color: colors.string },
  ]);
}

const lightHighlightStyle = buildHighlightStyle(lightSyntaxColors);
const darkHighlightStyle = buildHighlightStyle(darkSyntaxColors);

function highlightStyleFor(theme: string): Extension {
  return syntaxHighlighting(isDarkTheme(theme) ? darkHighlightStyle : lightHighlightStyle, {
    fallback: true,
  });
}

export const syntaxThemeCompartment = new Compartment();

export function syntaxThemeExtension(theme: string): Extension {
  return syntaxThemeCompartment.of(highlightStyleFor(theme));
}

export function reconfigureSyntaxTheme(theme: string) {
  return syntaxThemeCompartment.reconfigure(highlightStyleFor(theme));
}
