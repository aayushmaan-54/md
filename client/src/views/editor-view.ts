import { createEditorView, loadNoteState, setSyntaxTheme, setTabWidth } from "../editor/view";
import type { TabWidthOption } from "../editor/tab-width";
import { renderPreview } from "../preview/render";
import { toggleTaskInSource } from "../preview/tasks";
import { debounce } from "../lib/debounce";
import { NotesStore } from "../notes/store";
import type { SaveState } from "../notes/store";
import type { Note } from "../notes/model";
import { exportNotesSeparately, exportNotesZipped } from "../notes/export";
import { exportNoteToPdf } from "../notes/pdf-export";
import { importZip } from "../notes/import-zip";
import { insertPastedImage } from "../images/insert";
import { escapeHtml } from "../lib/html";
import { renderSidebar } from "./sidebar-view";
import { buildShellHtml } from "./editor-view.template";
import { createConfirmDialog } from "./confirm-dialog";
import type { SidebarHandles } from "./sidebar-view";
import { countChars, countWords } from "../lib/text-stats";
import { applyFont, applyTheme, THEMES } from "../lib/appearance";
import type { Font, Theme } from "../lib/appearance";
import { icon } from "../lib/icons";
import { copyToClipboard } from "../lib/clipboard";
import { clearLoggedIn, hasLoggedInBefore, logout, markLoggedIn, me } from "../api/auth";
import { getSetting, putSetting } from "../storage/settings-db";
import type { User } from "../api/auth";
import { isUnauthorized } from "../api/client";
import { renderLoginView } from "./login-view";
import { renderSignupView } from "./signup-view";
import { showUndoToast, showStatusToast } from "../lib/toast";
import { describeApiError } from "../lib/form";

const DEMO_SEEDED_KEY = "hasSeededDemo";

const DEMO_DOC = `# Welcome to MD

A local-first markdown workspace. This is a **demo document** so you can
see the editor, the *live preview*, and the code highlighting working
before more of the app exists.

## Try it out

- Bullet list item
- Another item
  - Nested item
1. First step
2. Second step

- [ ] An unchecked task
- [x] A finished task

> A blockquote for callouts and quotes.

Here's some \`inline code\` and a [link](https://example.com).

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

| Feature | Status |
| --- | --- |
| Editor | Done |
| Preview | Done |
| Sync | Not yet |
`;

type ViewMode = "editor" | "split" | "preview";
const MODES: ViewMode[] = ["editor", "split", "preview"];

export function renderEditorView(root: HTMLElement) {
  root.innerHTML = buildShellHtml();

  const shell = root.querySelector<HTMLElement>(".app-shell")!;
  const sidebarRoot = root.querySelector<HTMLElement>("#sidebar")!;
  const sidebarBackdrop = root.querySelector<HTMLElement>("#sidebar-backdrop")!;
  const appBody = root.querySelector<HTMLElement>(".app-body")!;
  const editorPane = root.querySelector<HTMLElement>("#editor-pane")!;
  const previewPane = root.querySelector<HTMLElement>("#preview-pane")!;
  const splitDivider = root.querySelector<HTMLElement>("#split-divider")!;
  const tabWidthSelect = root.querySelector<HTMLSelectElement>(
    "#tab-width-select",
  )!;
  const modeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-mode]"),
  );
  const sidebarToggleButton = root.querySelector<HTMLButtonElement>(
    "#sidebar-toggle",
  )!;
  const statusDot = root.querySelector<HTMLElement>("#status-dot")!;
  const statusText = root.querySelector<HTMLElement>("#status-text")!;
  const docStats = root.querySelector<HTMLElement>("#doc-stats")!;
  const syncMessage = root.querySelector<HTMLElement>("#sync-message")!;
  const pullButton = root.querySelector<HTMLButtonElement>("#pull-button")!;
  const pushButton = root.querySelector<HTMLButtonElement>("#push-button")!;
  const shortcutsDialog = root.querySelector<HTMLDialogElement>(
    "#shortcuts-dialog",
  )!;
  const imageUploadButton = root.querySelector<HTMLButtonElement>(
    "#image-upload-button",
  )!;
  const imageUploadInput = root.querySelector<HTMLInputElement>(
    "#image-upload-input",
  )!;
  const pdfExportButton = root.querySelector<HTMLButtonElement>(
    "#pdf-export-button",
  )!;
  const appearanceButton = root.querySelector<HTMLButtonElement>(
    "#appearance-button",
  )!;
  const appearanceDialog = root.querySelector<HTMLDialogElement>(
    "#appearance-dialog",
  )!;
  const themeSelect = root.querySelector<HTMLSelectElement>("#theme-select")!;
  const fontSelect = root.querySelector<HTMLSelectElement>("#font-select")!;
  const authDialog = root.querySelector<HTMLDialogElement>("#auth-dialog")!;
  const authDialogMessage = root.querySelector<HTMLElement>(
    "#auth-dialog-message",
  )!;
  const authDialogContent = root.querySelector<HTMLElement>(
    "#auth-dialog-content",
  )!;
  const exportDialog = root.querySelector<HTMLDialogElement>(
    "#export-dialog",
  )!;
  const exportNoteList = root.querySelector<HTMLElement>(
    "#export-note-list",
  )!;
  const exportConfirmButton = root.querySelector<HTMLButtonElement>(
    "#export-confirm",
  )!;
  const confirmDialog = createConfirmDialog(root);
  const noteImportInput = root.querySelector<HTMLInputElement>(
    "#note-import-input",
  )!;
  const settingsImportButton = root.querySelector<HTMLButtonElement>(
    "#settings-import-button",
  )!;
  const settingsExportButton = root.querySelector<HTMLButtonElement>(
    "#settings-export-button",
  )!;

  const isNarrowViewport = () => window.matchMedia("(max-width: 860px)").matches;

  // Wires a dialog's close button (and, unless disabled, a backdrop
  // click) to the same close logic. Backdrop-close is off for the auth
  // dialog — a login/signup form losing its half-typed input from a
  // stray outside click is worse than for a purely informational dialog.
  function wireDialogClose(
    dialog: HTMLDialogElement,
    closeButton: HTMLButtonElement,
    onClose?: () => void,
    closeOnBackdrop = true,
  ) {
    const close = () => {
      onClose?.();
      dialog.close();
    };
    closeButton.addEventListener("click", close);
    if (closeOnBackdrop) {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) close();
      });
    }
  }

  let mode: ViewMode = "editor";
  let activeId: string | null = null;
  let sidebarHandles!: SidebarHandles;
  // Starts closed on a narrow viewport, where the sidebar overlays the
  // content instead of sitting beside it.
  let sidebarHidden = isNarrowViewport();
  let currentUser: User | null = null;
  let pendingAfterAuth: (() => void) | null = null;
  let currentTabWidth: TabWidthOption = 4;
  let hasUnsavedWork = false;
  let syncInFlight = false;
  const scrollPositions = new Map<string, number>();

  function applyMode() {
    shell.dataset.mode = mode;
    for (const button of modeButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === mode),
      );
    }
    // The dragged split ratio only applies while both panes are visible —
    // outside split mode, let the CSS default (flex: 1) fill the row.
    if (mode !== "split") editorPane.style.flex = "";
  }

  function setMode(next: ViewMode) {
    mode = next;
    applyMode();
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () =>
      setMode(button.dataset.mode as ViewMode),
    );
  }

  const scheduleRenderPreview = debounce((source: string) => {
    void renderPreview(previewPane, source);
  }, 200);

  function refreshSidebar() {
    sidebarHandles.refresh(store.list(), activeId);
  }

  function setSidebarHidden(hidden: boolean) {
    sidebarHidden = hidden;
    shell.dataset.sidebarHidden = String(hidden);
    sidebarToggleButton.setAttribute("aria-pressed", String(!hidden));
  }

  function toggleSidebar() {
    setSidebarHidden(!sidebarHidden);
  }

  function closeSidebarIfNarrow() {
    if (isNarrowViewport()) setSidebarHidden(true);
  }

  sidebarBackdrop.addEventListener("click", () => setSidebarHidden(true));

  function toggleShortcutsDialog() {
    wakeChrome();
    if (shortcutsDialog.open) shortcutsDialog.close();
    else shortcutsDialog.showModal();
  }

  function openExportDialog() {
    wakeChrome();
    const notes = store.list();
    exportNoteList.innerHTML = notes
      .map(
        (note) => `
          <label class="export-note-item">
            <input type="checkbox" value="${note.id}" checked />
            ${escapeHtml(note.title)}
          </label>
        `,
      )
      .join("");
    exportDialog.showModal();
  }

  function updateAuthIndicator() {
    sidebarHandles.setAuthStatus(currentUser);
  }

  function showLoginInDialog() {
    renderLoginView(authDialogContent, {
      onSuccess: (user) => handleAuthenticated(user),
      onSwitchToSignup: () => showSignupInDialog(),
    });
  }

  function showSignupInDialog() {
    renderSignupView(authDialogContent, {
      onSuccess: (user) => handleAuthenticated(user),
      onSwitchToLogin: () => showLoginInDialog(),
    });
  }

  function handleAuthenticated(user: User) {
    currentUser = user;
    void markLoggedIn();
    updateAuthIndicator();
    authDialog.close();

    // Auto-pull on every successful login, then resume whatever else was
    // pending (e.g. a push blocked by a 401).
    void handlePull().then(() => {
      const resume = pendingAfterAuth;
      pendingAfterAuth = null;
      resume?.();
    });
  }

  // Opens the login/signup dialog. `onAuthenticated`, if given, re-runs
  // once login succeeds — used so a push/pull blocked by a 401 resumes
  // right where it left off instead of just failing.
  function openAuthDialog(message: string, onAuthenticated?: () => void) {
    wakeChrome();
    pendingAfterAuth = onAuthenticated ?? null;
    authDialogMessage.textContent = message;
    showLoginInDialog();
    authDialog.showModal();
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Already logged out server-side (e.g. expired session) — proceed
      // to clear local state regardless.
    }
    currentUser = null;
    void clearLoggedIn();
    updateAuthIndicator();
  }

  // Re-renders the preview too, so a visible code block's highlighting
  // doesn't sit stale in the old theme.
  function refreshSyntaxTheme(theme: string) {
    setSyntaxTheme(view, theme);
    void renderPreview(previewPane, view.state.doc.toString());
  }

  function cycleTheme() {
    const current = (document.documentElement.dataset.theme as Theme) || THEMES[0];
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(next);
    themeSelect.value = next;
    refreshSyntaxTheme(next);
  }

  function selectRelativeNote(offset: -1 | 1) {
    const notes = store.list();
    if (notes.length === 0) return;

    const currentIndex = notes.findIndex((note) => note.id === activeId);
    const nextIndex =
      ((currentIndex === -1 ? 0 : currentIndex) + offset + notes.length) %
      notes.length;
    void selectNote(notes[nextIndex].id);
  }

  function updateStats(content: string) {
    docStats.textContent = `${countWords(content)} words · ${countChars(content)} chars`;
  }

  function formatClock(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function setSaveState(state: SaveState) {
    hasUnsavedWork = state === "saving";
    statusDot.dataset.state = state;
    statusText.textContent =
      state === "saving" ? "Saving…" : `Saved ${formatClock()}`;
  }

  // Fades the header/footer chrome to a low opacity while the user is
  // actively typing (reveal on hover via CSS), so the writing surface
  // isn't competing with UI for attention; settles back after a pause.
  let dozeTimer: ReturnType<typeof setTimeout> | undefined;
  function noteTypingActivity() {
    document.body.classList.add("dozing");
    clearTimeout(dozeTimer);
    dozeTimer = setTimeout(() => document.body.classList.remove("dozing"), 2200);
  }
  function wakeChrome() {
    clearTimeout(dozeTimer);
    document.body.classList.remove("dozing");
  }

  function handleDocChange(doc: string) {
    if (!activeId) return;
    noteTypingActivity();
    store.updateContent(activeId, doc);
    scheduleRenderPreview(doc);
    updateStats(doc);
  }

  function loadIntoEditor(content: string) {
    loadNoteState(view, content, {
      tabWidth: currentTabWidth,
      onChange: handleDocChange,
    });
    void renderPreview(previewPane, content);
    // renderPreview() otherwise preserves scrollTop across a re-render —
    // this is a different note, so start its preview at the top.
    previewPane.scrollTop = 0;
    updateStats(content);
  }

  async function handlePush() {
    pushButton.disabled = true;
    syncInFlight = true;
    syncMessage.textContent = "Pushing…";
    try {
      if (activeId) await store.flush(activeId);
      const { pushed, conflicts } = await store.pushAll();
      syncMessage.textContent =
        conflicts > 0
          ? `Pushed ${pushed}, ${conflicts} conflict${conflicts === 1 ? "" : "s"}`
          : `Pushed ${pushed} note${pushed === 1 ? "" : "s"}`;
    } catch (err) {
      if (isUnauthorized(err)) {
        syncMessage.textContent = "Log in to push your notes.";
        openAuthDialog("Log in to push your notes to the database.", () =>
          void handlePush(),
        );
      } else {
        syncMessage.textContent = `Push failed: ${describeApiError(err)}`;
      }
    } finally {
      pushButton.disabled = false;
      syncInFlight = false;
    }
  }

  async function handlePull() {
    pullButton.disabled = true;
    syncInFlight = true;
    syncMessage.textContent = "Pulling…";
    try {
      const { added, skipped } = await store.pull();
      syncMessage.textContent = `Pulled ${added} new note${added === 1 ? "" : "s"}${
        skipped > 0 ? `, ${skipped} already local` : ""
      }`;
    } catch (err) {
      if (isUnauthorized(err)) {
        syncMessage.textContent = "Log in to pull your notes.";
        openAuthDialog("Log in to pull your notes from the database.", () =>
          void handlePull(),
        );
      } else {
        syncMessage.textContent = `Pull failed: ${describeApiError(err)}`;
      }
    } finally {
      pullButton.disabled = false;
      syncInFlight = false;
    }
  }

  async function selectNote(id: string) {
    if (id === activeId) return;

    if (activeId) {
      scrollPositions.set(activeId, view.scrollDOM.scrollTop);
      await store.flush(activeId);
    }

    const note = store.get(id);
    if (!note) return;

    activeId = id;
    loadIntoEditor(note.content);
    refreshSidebar();
    closeSidebarIfNarrow();

    requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = scrollPositions.get(id) ?? 0;
    });
  }

  async function createNewNote() {
    if (activeId) await store.flush(activeId);
    const note = await store.create("", "Untitled");
    activeId = note.id;
    loadIntoEditor(note.content);
    refreshSidebar();
    closeSidebarIfNarrow();
  }

  function deleteNote(id: string) {
    const note = store.softDelete(id);
    if (!note) return;

    const wasActive = id === activeId;
    if (wasActive) {
      const next = store.list()[0];
      activeId = next?.id ?? null;
      loadIntoEditor(next?.content ?? "");
    }
    refreshSidebar();

    showUndoToast(`Deleted "${note.title}"`, {
      onUndo: () => {
        store.undelete(id);
        if (wasActive) {
          activeId = id;
          loadIntoEditor(note.content);
        }
        refreshSidebar();
      },
      onExpire: () => void store.commitDelete(id),
    });
  }

  async function importFiles(files: FileList | File[]) {
    const all = Array.from(files);
    const zipFiles = all.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    const mdFiles = all.filter((file) => !file.name.toLowerCase().endsWith(".zip"));

    const created: Note[] = [];
    if (mdFiles.length > 0) created.push(...(await store.importFiles(mdFiles)));

    for (const zipFile of zipFiles) {
      try {
        const entries = await importZip(zipFile);
        for (const entry of entries) {
          created.push(await store.create(entry.content, entry.fallbackTitle));
        }
      } catch {
        const toast = showStatusToast(`Couldn't read "${zipFile.name}" as a zip archive.`);
        setTimeout(() => toast.close(), 4000);
      }
    }

    const first = created[0];
    if (first) await selectNote(first.id);
    else refreshSidebar();
  }

  const store = new NotesStore({
    onListChanged: refreshSidebar,
    onSaveStateChanged: setSaveState,
  });

  const view = createEditorView(editorPane, "", {
    tabWidth: currentTabWidth,
    onChange: handleDocChange,
  });

  pushButton.addEventListener("click", () => {
    void confirmDialog.confirm(
      "Push notes?",
      "Writes your local changes to the database as a checkpoint.",
    ).then((ok) => {
      if (ok) void handlePush();
    });
  });
  pullButton.addEventListener("click", () => {
    void confirmDialog.confirm(
      "Pull notes?",
      "New notes from the database will be added locally. Existing local notes are left untouched.",
    ).then((ok) => {
      if (ok) void handlePull();
    });
  });
  sidebarToggleButton.addEventListener("click", () => toggleSidebar());

  pdfExportButton.addEventListener("click", () => {
    const note = activeId ? store.get(activeId) : undefined;
    if (note) void exportNoteToPdf(note);
  });

  imageUploadButton.addEventListener("click", () => imageUploadInput.click());

  imageUploadInput.addEventListener("change", () => {
    const files = Array.from(imageUploadInput.files ?? []);
    imageUploadInput.value = "";
    if (files.length === 0 || !activeId) return;

    // Sequential, not Promise.all: each call reads the current cursor
    // position at call time, so firing them concurrently would have every
    // file after the first insert at a now-stale position.
    void (async () => {
      for (const file of files) await insertPastedImage(view, file);
    })();
  });

  sidebarHandles = renderSidebar(sidebarRoot, {
    onSelect: (id) => void selectNote(id),
    onDelete: (id) => void deleteNote(id),
    onNew: () => void createNewNote(),
    onRename: (id, title) => {
      void store.rename(id, title).catch((err) => {
        const toast = showStatusToast(`Rename failed: ${describeApiError(err)}`);
        setTimeout(() => toast.close(), 4000);
      });
    },
    onAuthAction: () => {
      if (currentUser) {
        void confirmDialog.confirm(
          "Log out?",
          "You'll need to log in again to sync your notes.",
        ).then((ok) => {
          if (ok) void handleLogout();
        });
      } else {
        openAuthDialog("Log in to sync your notes.");
      }
    },
  });

  settingsImportButton.addEventListener("click", () => noteImportInput.click());

  noteImportInput.addEventListener("change", () => {
    const files = noteImportInput.files;
    if (files && files.length > 0) {
      appearanceDialog.close();
      void importFiles(files);
    }
    noteImportInput.value = "";
  });

  settingsExportButton.addEventListener("click", () => {
    appearanceDialog.close();
    openExportDialog();
  });

  root
    .querySelector<HTMLButtonElement>("#shortcuts-button")!
    .addEventListener("click", () => toggleShortcutsDialog());

  wireDialogClose(shortcutsDialog, root.querySelector("#shortcuts-close")!);
  wireDialogClose(exportDialog, root.querySelector("#export-dialog-close")!);

  exportConfirmButton.addEventListener("click", async () => {
    const selectedIds = Array.from(
      exportNoteList.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:checked',
      ),
    ).map((input) => input.value);
    const selectedNotes = store
      .list()
      .filter((note) => selectedIds.includes(note.id));
    if (selectedNotes.length === 0) return;

    const mode = exportDialog.querySelector<HTMLInputElement>(
      'input[name="export-mode"]:checked',
    )!.value;

    exportConfirmButton.disabled = true;
    try {
      if (mode === "zip") await exportNotesZipped(selectedNotes);
      else await exportNotesSeparately(selectedNotes);
      exportDialog.close();
    } finally {
      exportConfirmButton.disabled = false;
    }
  });

  // main.ts already applied the persisted theme/font (from IndexedDB) to
  // <html>'s dataset before this view was ever rendered — just reflect
  // that into the selects rather than re-reading storage here.
  themeSelect.value = document.documentElement.dataset.theme ?? "sage";
  fontSelect.value = document.documentElement.dataset.font ?? "jbmono";

  appearanceButton.addEventListener("click", () => {
    wakeChrome();
    if (appearanceDialog.open) appearanceDialog.close();
    else appearanceDialog.showModal();
  });

  wireDialogClose(appearanceDialog, root.querySelector("#appearance-close")!);

  themeSelect.addEventListener("change", () => {
    applyTheme(themeSelect.value as Theme);
    refreshSyntaxTheme(themeSelect.value);
  });
  fontSelect.addEventListener("change", () =>
    applyFont(fontSelect.value as Font),
  );

  wireDialogClose(
    authDialog,
    root.querySelector("#auth-dialog-close")!,
    () => {
      pendingAfterAuth = null;
    },
    false,
  );

  tabWidthSelect.addEventListener("change", () => {
    const value = tabWidthSelect.value;
    const option: TabWidthOption =
      value === "tab" ? "tab" : (Number(value) as 2 | 4 | 8);
    currentTabWidth = option;
    setTabWidth(view, option);
  });

  // Clicking a rendered task checkbox toggles it in the source, which
  // re-triggers a preview render through the normal doc-change path.
  previewPane.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== "checkbox" || target.dataset.taskIndex === undefined)
      return;

    const taskIndex = Number(target.dataset.taskIndex);
    const change = toggleTaskInSource(view.state.doc.toString(), taskIndex);
    if (change === null) return;

    view.dispatch({ changes: change });
  });

  // Copy button on rendered code blocks — delegated since it's injected
  // via innerHTML, not created here.
  previewPane.addEventListener("click", (event) => {
    const target = event.target;
    // Element, not HTMLElement: a click can land on the button's <svg> icon.
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>("[data-copy-code]");
    if (!button) return;

    const code = button.dataset.copyCode ?? "";
    void copyToClipboard(code).then((ok) => {
      const original = button.innerHTML;
      button.innerHTML = ok
        ? `${icon("check")}<span>Copied</span>`
        : `${icon("x")}<span>Couldn't copy</span>`;
      button.disabled = true;
      setTimeout(() => {
        button.innerHTML = original;
        button.disabled = false;
      }, 1500);
    });
  });

  // Synced scrolling in split mode, guarded against feedback loops and
  // coalesced to one update per animation frame to avoid scroll jank.
  let syncingScroll = false;
  let scrollSyncFrame: number | null = null;

  function proportionalScroll(source: HTMLElement, target: HTMLElement) {
    const sourceRange = source.scrollHeight - source.clientHeight;
    if (sourceRange <= 0) return;
    const ratio = source.scrollTop / sourceRange;
    const targetRange = target.scrollHeight - target.clientHeight;
    target.scrollTop = ratio * targetRange;
  }

  function scheduleScrollSync(source: HTMLElement, target: HTMLElement) {
    if (scrollSyncFrame !== null) return;
    scrollSyncFrame = requestAnimationFrame(() => {
      scrollSyncFrame = null;
      syncingScroll = true;
      proportionalScroll(source, target);
      // target's own "scroll" event for this programmatic change fires
      // asynchronously (next frame), not within this callback — clearing
      // the guard here would let it slip through and bounce back.
      requestAnimationFrame(() => {
        syncingScroll = false;
      });
    });
  }

  view.scrollDOM.addEventListener(
    "scroll",
    () => {
      if (mode !== "split" || syncingScroll) return;
      scheduleScrollSync(view.scrollDOM, previewPane);
    },
    { passive: true },
  );

  previewPane.addEventListener(
    "scroll",
    () => {
      if (mode !== "split" || syncingScroll) return;
      scheduleScrollSync(previewPane, view.scrollDOM);
    },
    { passive: true },
  );

  // Drag the divider to resize the split. Min/max is a pixel width, not
  // a fixed percentage, so a narrow window can't wrap either pane down
  // to one word per line.
  const MIN_PANE_PX = 280;
  const SPLIT_NUDGE_STEP = 0.05;
  let splitRatio = 0.5;

  function paneRatioBounds() {
    const total = appBody.getBoundingClientRect().width || 1;
    const minRatio = Math.min(0.5, MIN_PANE_PX / total);
    return { min: minRatio, max: 1 - minRatio };
  }

  function setSplitRatio(ratio: number) {
    const { min, max } = paneRatioBounds();
    splitRatio = Math.min(max, Math.max(min, ratio));
    editorPane.style.flex = `0 0 ${splitRatio * 100}%`;
  }

  function nudgeSplitRatio(delta: number) {
    if (mode !== "split") return;
    setSplitRatio(splitRatio + delta);
  }

  splitDivider.addEventListener("mousedown", (event) => {
    if (mode !== "split") return;
    event.preventDefault();

    document.body.classList.add("is-resizing-split");

    function onMouseMove(moveEvent: MouseEvent) {
      const rect = appBody.getBoundingClientRect();
      setSplitRatio((moveEvent.clientX - rect.left) / rect.width);
    }

    function onMouseUp() {
      document.body.classList.remove("is-resizing-split");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // Double-click the divider to reset back to an even split.
  splitDivider.addEventListener("dblclick", () => {
    if (mode === "split") setSplitRatio(0.5);
  });

  function isEditableTarget(el: Element | null): boolean {
    if (!el) return false;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
    return el instanceof HTMLElement && el.isContentEditable;
  }

  function isAnyDialogOpen(): boolean {
    return (
      shortcutsDialog.open ||
      appearanceDialog.open ||
      authDialog.open ||
      exportDialog.open ||
      confirmDialog.isOpen()
    );
  }

  // Every app-level shortcut lives in one capture-phase document listener,
  // so it wins over whatever has focus — the editor, the sidebar search
  // box, the rename field. Formatting shortcuts (bold, italic, task
  // toggle, line move, etc.) stay inside CodeMirror's own keymap instead,
  // since they only make sense with editor focus.
  document.addEventListener(
    "keydown",
    (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const alt = event.altKey;
      const shift = event.shiftKey;
      const key = event.key;

      const handle = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      // Help works even with a dialog open (F1 can still close its own);
      // every other shortcut below is suppressed while one is open.
      if (key === "F1" && !mod && !alt && !shift) {
        handle();
        toggleShortcutsDialog();
        return;
      }
      if (key === "?" && !mod && !alt && !isEditableTarget(document.activeElement)) {
        handle();
        toggleShortcutsDialog();
        return;
      }
      if (isAnyDialogOpen()) return;

      // Views
      if (alt && !mod && !shift && (key === "1" || key === "2" || key === "3")) {
        handle();
        setMode(MODES[Number(key) - 1]);
        return;
      }
      if (alt && !mod && !shift && key.toLowerCase() === "v") {
        handle();
        setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
        return;
      }
      if (alt && !mod && !shift && key.toLowerCase() === "t") {
        handle();
        cycleTheme();
        return;
      }
      if (
        alt &&
        shift &&
        !mod &&
        mode === "split" &&
        (key === "ArrowLeft" || key === "ArrowRight")
      ) {
        handle();
        nudgeSplitRatio(key === "ArrowLeft" ? -SPLIT_NUDGE_STEP : SPLIT_NUDGE_STEP);
        return;
      }

      // Files
      if (mod && !alt && !shift && key.toLowerCase() === "k") {
        handle();
        sidebarHandles.focusSearch();
        return;
      }
      if (alt && !mod && !shift && key.toLowerCase() === "n") {
        handle();
        void createNewNote();
        return;
      }
      if (key === "F2" && !mod && !alt && !shift) {
        handle();
        sidebarHandles.renameActive();
        return;
      }
      if (mod && shift && !alt && key.toLowerCase() === "k") {
        handle();
        if (activeId) void deleteNote(activeId);
        return;
      }
      if (alt && !mod && !shift && (key === "ArrowUp" || key === "ArrowDown")) {
        handle();
        selectRelativeNote(key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (mod && !alt && !shift && key === "/") {
        handle();
        toggleSidebar();
        return;
      }

      // Saving
      if (mod && !alt && !shift && key.toLowerCase() === "s") {
        handle();
        if (activeId) void store.flush(activeId);
        return;
      }
      if (mod && shift && !alt && key.toLowerCase() === "s") {
        handle();
        void handlePush();
        return;
      }
      if (mod && shift && !alt && key.toLowerCase() === "e") {
        handle();
        void handlePull();
        return;
      }
    },
    { capture: true },
  );

  // Warns before closing/reloading while a debounced autosave hasn't
  // landed yet, or a push/pull is in flight.
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedWork && !syncInFlight) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // Bulk import via drag-and-drop anywhere on the window. dragover must
  // call preventDefault() or the browser refuses the drop entirely and
  // just navigates to/opens the file instead.
  window.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    document.body.classList.add("is-dragging-file");
  });

  window.addEventListener("dragleave", (event) => {
    if (event.relatedTarget === null) document.body.classList.remove("is-dragging-file");
  });

  window.addEventListener("drop", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    document.body.classList.remove("is-dragging-file");

    const importableFiles = Array.from(event.dataTransfer.files).filter((file) =>
      /\.(md|zip)$/i.test(file.name),
    );
    if (importableFiles.length > 0) void importFiles(importableFiles);
  });

  async function bootstrap() {
    await store.load();
    // Only ever seeded once — otherwise deleting every note (including the
    // demo itself) would just bring it right back on the next reload.
    if (store.list().length === 0 && !(await getSetting(DEMO_SEEDED_KEY))) {
      await store.create(DEMO_DOC, "Welcome to MD");
    }
    void putSetting(DEMO_SEEDED_KEY, "true");

    const first = store.list()[0];
    if (first) {
      activeId = first.id;
      loadIntoEditor(first.content);
    }
    refreshSidebar();

    // Skips a guaranteed-401 call for a device that's never logged in —
    // otherwise every load, even fully offline use, pays for one.
    if (await hasLoggedInBefore()) {
      try {
        currentUser = await me();
      } catch {
        currentUser = null;
      }
    } else {
      currentUser = null;
    }
    updateAuthIndicator();
  }

  void bootstrap();

  applyMode();
  setSidebarHidden(sidebarHidden);
}
