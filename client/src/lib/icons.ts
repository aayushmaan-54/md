const SPRITE = "/ui-icons.svg";

// viewBox/size are set here rather than left to the <symbol>, since a
// cross-document <use> can otherwise render off-center.
export function icon(name: string, extraClass = ""): string {
  const cls = extraClass ? `icon icon-${name} ${extraClass}` : `icon icon-${name}`;
  return `<svg class="${cls}" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="${SPRITE}#icon-${name}"></use></svg>`;
}
