import { zipSync } from "fflate";
import type { Note } from "./model";
import { findLocalImageIds, rewriteLocalImageRefs } from "../images/model";
import { getImage } from "../storage/images-db";
import { blobToDataUrl } from "../lib/blob";

function fileNameFor(title: string): string {
  const trimmed = title.trim() || "untitled";
  return `${trimmed.replace(/[\\/:*?"<>|]/g, "-")}.md`;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string): void {
  downloadBlob(filename, new Blob([content], { type: "text/markdown" }));
}

// De-dupes filenames within the archive (two notes titled the same don't
// silently overwrite each other in the zip) the same way the sync pull
// merge does for local title collisions.
function uniqueFileNames(notes: Note[]): Map<Note, string> {
  const seen = new Set<string>();
  const names = new Map<Note, string>();

  for (const note of notes) {
    let name = fileNameFor(note.title);
    let n = 2;
    while (seen.has(name)) {
      name = fileNameFor(`${note.title} ${n}`);
      n++;
    }
    seen.add(name);
    names.set(note, name);
  }

  return names;
}

// A note's markdown references its images as ![](local-image:<uuid>) —
// meaningful only inside this browser's IndexedDB (see images/model.ts).
// A standalone exported .md file can't reference that, so each pasted
// image is inlined as a base64 data URI instead: no folder needed, the
// file stays fully self-contained and viewable anywhere.
async function inlineImagesAsDataUrls(content: string): Promise<string> {
  const ids = findLocalImageIds(content);
  if (ids.length === 0) return content;

  const dataUrls = new Map<string, string>();
  for (const id of ids) {
    if (dataUrls.has(id)) continue;
    const image = await getImage(id);
    if (image) dataUrls.set(id, await blobToDataUrl(image.blob));
  }

  return rewriteLocalImageRefs(content, (id) => dataUrls.get(id) ?? localImageMissing(id));
}

function localImageMissing(id: string): string {
  return `local-image:${id}`;
}

export async function exportNote(note: Note): Promise<void> {
  const content = await inlineImagesAsDataUrls(note.content);
  downloadTextFile(fileNameFor(note.title), content);
}

// One browser download per note — no zipping, so large batches will
// likely hit the browser's multi-download permission prompt. Images are
// inlined as data URIs per note (see inlineImagesAsDataUrls) since a
// bare file download can't carry a companion images/ folder.
export async function exportNotesSeparately(notes: Note[]): Promise<void> {
  for (const note of notes) await exportNote(note);
}

// Zip export instead bundles referenced images as real files under
// images/ (deduped once per id, even if reused across several notes) and
// rewrites each note's refs to that relative path — this is the "export
// alongside an images/ folder... self-contained" shape from the README.
export async function exportNotesZipped(notes: Note[]): Promise<void> {
  const names = uniqueFileNames(notes);
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};

  const allIds = new Set(notes.flatMap((note) => findLocalImageIds(note.content)));
  for (const id of allIds) {
    const image = await getImage(id);
    if (image) files[`images/${id}.webp`] = new Uint8Array(await image.blob.arrayBuffer());
  }

  for (const note of notes) {
    const content = rewriteLocalImageRefs(
      note.content,
      (id) => (files[`images/${id}.webp`] ? `images/${id}.webp` : localImageMissing(id)),
    );
    files[names.get(note)!] = encoder.encode(content);
  }

  const zipped = zipSync(files);
  downloadBlob("notes.zip", new Blob([zipped], { type: "application/zip" }));
}
