import { renderPreview } from "../preview/render";
import { escapeHtml } from "../lib/html";
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
  printArea.innerHTML = `<h1>${escapeHtml(note.title)}</h1>`;

  const body = document.createElement("div");
  printArea.appendChild(body);
  await renderPreview(body, note.content);

  const previousTitle = document.title;
  document.title = note.title || "Untitled";

  window.print();

  document.title = previousTitle;
}
