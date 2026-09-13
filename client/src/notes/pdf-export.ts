import { renderPreview } from "../preview/render";
import { stripDerivedTitleHeading } from "./model";
import type { Note } from "./model";

const PRINT_AREA_ID = "pdf-print-area";

function getOrCreatePrintArea(): HTMLElement {
  let el = document.getElementById(PRINT_AREA_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = PRINT_AREA_ID;
    document.body.appendChild(el);
  }
  return el;
}

// "Export to PDF" per the README is just the browser's own print dialog
// (Save as PDF) aimed at a print-only stylesheet — no PDF-generation
// library. The note is rendered into a dedicated off-screen container;
// @media print in style.css hides everything else on the page and shows
// only that container while printing.
export async function exportNoteToPdf(note: Note): Promise<void> {
  const printArea = getOrCreatePrintArea();
  printArea.innerHTML = "";

  // .markdown-content gives both the title and the rendered body the
  // same heading/table/code/mark styling the live preview uses — see
  // that class in style.css. renderPreview() owns the body div's
  // innerHTML entirely, so the title has to be a sibling, not a child
  // of it, or it'd get wiped out on the next render.
  const wrapper = document.createElement("div");
  wrapper.className = "markdown-content";
  printArea.appendChild(wrapper);

  const heading = document.createElement("h1");
  heading.textContent = note.title || "Untitled";
  wrapper.appendChild(heading);

  const body = document.createElement("div");
  wrapper.appendChild(body);
  await renderPreview(body, stripDerivedTitleHeading(note.content, note.title));

  const previousTitle = document.title;
  document.title = note.title || "Untitled";

  window.print();

  document.title = previousTitle;
}
