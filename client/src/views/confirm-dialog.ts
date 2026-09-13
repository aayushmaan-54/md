export type ConfirmDialog = {
  confirm: (title: string, message: string) => Promise<boolean>;
  isOpen: () => boolean;
};

// Shared yes/no prompt for actions worth double-checking (push, pull,
// logout). Escape/backdrop/no-button all resolve false, same as declining.
export function createConfirmDialog(root: HTMLElement): ConfirmDialog {
  const dialog = root.querySelector<HTMLDialogElement>("#confirm-dialog")!;
  const title = root.querySelector<HTMLElement>("#confirm-title")!;
  const message = root.querySelector<HTMLElement>("#confirm-message")!;
  const okButton = root.querySelector<HTMLButtonElement>("#confirm-ok")!;
  const cancelButton = root.querySelector<HTMLButtonElement>("#confirm-cancel")!;

  function confirm(titleText: string, messageText: string): Promise<boolean> {
    title.textContent = titleText;
    message.textContent = messageText;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        dialog.close();
        resolve(result);
      };
      okButton.onclick = () => settle(true);
      cancelButton.onclick = () => settle(false);
      dialog.onclose = () => settle(false);
      dialog.showModal();
    });
  }

  return { confirm, isOpen: () => dialog.open };
}
