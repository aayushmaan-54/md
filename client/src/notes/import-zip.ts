import { unzipSync } from "fflate";
import { putImage } from "../storage/images-db";
import { localImageHref } from "../images/model";

const ZIP_IMAGE_PATH = /^images\/([^/]+)\.webp$/;
const ZIP_IMAGE_REF = /images\/([^/)\s]+)\.webp/g;

export type ImportedZipNote = { content: string; fallbackTitle: string };

// Mirrors exportNotesZipped: each images/<id>.webp becomes a local image
// again (under a freshly generated id), and every images/<id>.webp
// reference in a note's content is rewritten back to local-image:<id> so
// it resolves from IndexedDB like a normally pasted image.
export async function importZip(file: File): Promise<ImportedZipNote[]> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));

  const idMap = new Map<string, string>();
  for (const [path, bytes] of Object.entries(entries)) {
    const match = ZIP_IMAGE_PATH.exec(path);
    if (!match) continue;

    const newId = crypto.randomUUID();
    const blob = new Blob([bytes], { type: "image/webp" });
    await putImage({
      id: newId,
      blob,
      bytes: blob.size,
      createdAt: Date.now(),
      remoteId: null,
    });
    idMap.set(match[1], newId);
  }

  const decoder = new TextDecoder();
  const notes: ImportedZipNote[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.endsWith(".md")) continue;

    const content = decoder.decode(bytes).replace(ZIP_IMAGE_REF, (whole, oldId: string) => {
      const newId = idMap.get(oldId);
      return newId ? localImageHref(newId) : whole;
    });
    const fallbackTitle = path.split("/").pop()!.replace(/\.md$/, "") || "Untitled";
    notes.push({ content, fallbackTitle });
  }

  return notes;
}
