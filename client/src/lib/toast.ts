export type UndoToastOptions = {
  onUndo: () => void;
  onExpire: () => void;
  durationMs?: number;
};

// Expects a `#toast-container` element to already exist in the document.
export function showUndoToast(message: string, options: UndoToastOptions): void {
  const { onUndo, onExpire, durationMs = 5000 } = options;

  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  const text = document.createElement("span");
  text.textContent = message;

  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.textContent = "Undo";

  toast.append(text, undoButton);
  container.prepend(toast);

  let settled = false;

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    toast.remove();
    onExpire();
  }, durationMs);

  undoButton.addEventListener("click", () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    toast.remove();
    onUndo();
  });
}

export type StatusToastHandle = {
  update: (message: string) => void;
  close: () => void;
};

// A toast with no buttons/auto-expiry, for a background task's progress
// (e.g. "Converting image…" while pasting). The caller owns its
// lifetime — call close() once the task settles (success or failure).
export function showStatusToast(message: string): StatusToastHandle {
  const container = document.getElementById("toast-container");

  const text = document.createElement("span");
  text.textContent = message;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.append(text);
  container?.prepend(toast);

  return {
    update: (next: string) => (text.textContent = next),
    close: () => toast.remove(),
  };
}
