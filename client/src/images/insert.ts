import type { EditorView } from "@codemirror/view";
import { convertToWebp } from "./convert";
import { IMAGE_QUOTA_BYTES, localImageHref } from "./model";
import { getTotalImageBytes, putImage, setImageRemoteId } from "../storage/images-db";
import { uploadImage } from "../api/images";
import { isForbidden, isUnauthorized } from "../api/client";
import { showStatusToast } from "../lib/toast";

let placeholderCounter = 0;

function replaceInDoc(view: EditorView, search: string, replacement: string) {
  const text = view.state.doc.toString();
  const from = text.indexOf(search);
  // Not found: the user deleted or edited over the placeholder while the
  // conversion/upload was in flight. Nothing to reconcile — the blob (if
  // one was saved) is just an unreferenced orphan; not worth a cleanup
  // pass for this.
  if (from === -1) return;

  view.dispatch({ changes: { from, to: from + search.length, insert: replacement } });
}

function showTransientMessage(message: string, durationMs = 4000) {
  const toast = showStatusToast(message);
  setTimeout(toast.close, durationMs);
}

// Runs on paste (see editor/image-paste.ts): inserts a text placeholder
// immediately so there's visible feedback right where the image will
// land, converts+stores the image while a status toast shows progress,
// then swaps the placeholder for the real markdown once ready. Matches
// the README: "A brief loader shows while the image is re-encoded...
// before insertion."
export async function insertPastedImage(
  view: EditorView,
  file: File,
): Promise<void> {
  const placeholder = `![Uploading image #${++placeholderCounter}…]()`;
  const { from, to } = view.state.selection.main;

  view.dispatch({
    changes: { from, to, insert: placeholder },
    selection: { anchor: from + placeholder.length },
  });

  const status = showStatusToast("🖼️ Converting image…");

  let webp: Blob;
  try {
    webp = await convertToWebp(file);
  } catch {
    status.close();
    replaceInDoc(view, placeholder, "");
    showTransientMessage("Couldn't process that image.");
    return;
  }

  const existingBytes = await getTotalImageBytes();
  if (existingBytes + webp.size > IMAGE_QUOTA_BYTES) {
    status.close();
    replaceInDoc(view, placeholder, "");
    showTransientMessage("Image storage quota exceeded (25 MB).");
    return;
  }

  const id = crypto.randomUUID();
  await putImage({ id, blob: webp, bytes: webp.size, createdAt: Date.now(), remoteId: null });

  replaceInDoc(view, placeholder, `![](${localImageHref(id)})`);
  status.close();

  // Best-effort background upload — auth is optional and sync-only, so a
  // logged-out user still gets a fully working local image; that case
  // (and a plain network failure) stays silent. A 403 means the local
  // quota check above passed but the server's own count didn't — e.g.
  // other devices already used up the account's 25MB — which the user
  // does need to know, since the image will never end up backed up.
  uploadImage(webp)
    .then((uploaded) => setImageRemoteId(id, uploaded.id))
    .catch((err) => {
      if (isForbidden(err)) {
        showTransientMessage(
          "Image saved locally, but the server storage quota is full — it wasn't backed up.",
          6000,
        );
      } else if (!isUnauthorized(err)) {
        showTransientMessage("Image saved locally, but the backup upload failed.");
      }
    });
}
