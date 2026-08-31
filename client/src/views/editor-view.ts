import { createEditorView, loadNoteState, setTabWidth } from "../editor/view";
import type { TabWidthOption } from "../editor/tab-width";
import { renderPreview } from "../preview/render";
import { toggleTaskInSource } from "../preview/tasks";
import { debounce } from "../lib/debounce";
import { NotesStore } from "../notes/store";
import type { SaveState } from "../notes/store";
import { exportNotesSeparately, exportNotesZipped } from "../notes/export";
import { exportNoteToPdf } from "../notes/pdf-export";
import { insertPastedImage } from "../images/insert";
import { escapeHtml } from "../lib/html";
import { renderSidebar } from "./sidebar-view";
import type { SidebarHandles } from "./sidebar-view";
import { countChars, countWords } from "../lib/text-stats";
import { applyFont, applyTheme } from "../lib/appearance";
import type { Font, Theme } from "../lib/appearance";
import { logout, me } from "../api/auth";
import type { User } from "../api/auth";
import { isUnauthorized } from "../api/client";
import { renderLoginView } from "./login-view";
import { renderSignupView } from "./signup-view";
import { showUndoToast } from "../lib/toast";

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
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar"></aside>
      <div class="main-column">
        <header class="app-header">
          <button
            type="button"
            id="sidebar-toggle"
            title="Show/hide sidebar"
            aria-pressed="true"
          >🗂️</button>
          <div class="mode-switcher" role="group" aria-label="View mode">
            <button type="button" data-mode="editor">Editor</button>
            <button type="button" data-mode="split">Split</button>
            <button type="button" data-mode="preview">Preview</button>
          </div>
          <div class="save-status" id="save-status">
            <span class="status-dot" id="status-dot" data-state="saved"></span>
            <span id="status-text">Saved</span>
          </div>
          <button type="button" id="image-upload-button" title="Insert image">🖼️</button>
          <input type="file" id="image-upload-input" accept="image/*" multiple hidden />
          <button type="button" id="pdf-export-button" title="Export to PDF">🖨️</button>
          <button type="button" id="appearance-button" title="Theme & font">🎨</button>
        </header>
        <main class="app-body">
          <div class="editor-pane" id="editor-pane"></div>
          <div class="split-divider" id="split-divider"></div>
          <div class="preview-pane" id="preview-pane"></div>
        </main>
        <footer class="app-footer">
          <div class="footer-info">
            <span class="doc-stats" id="doc-stats">0 words · 0 chars</span>
            <label class="tab-width-picker">
              Tab width
              <select id="tab-width-select">
                <option value="2">2 spaces</option>
                <option value="4" selected>4 spaces</option>
                <option value="8">8 spaces</option>
                <option value="tab">Tab character</option>
              </select>
            </label>
          </div>
          <div class="sync-controls">
            <span class="sync-message" id="sync-message"></span>
            <button type="button" id="pull-button">⬇️ Pull</button>
            <button type="button" id="push-button">⬆️ Push</button>
            <button type="button" id="shortcuts-button" title="Keyboard shortcuts">❓</button>
          </div>
        </footer>
      </div>
    </div>
    <dialog id="shortcuts-dialog">
      <button type="button" id="shortcuts-close" class="shortcuts-close" title="Close" aria-label="Close">✕</button>
      <h2>Keyboard shortcuts</h2>

      <h3>Files</h3>
      <table>
        <tr><th>Action</th><th>Shortcut</th></tr>
        <tr><td>Search files</td><td>Ctrl + K</td></tr>
        <tr><td>New file</td><td>Alt + N</td></tr>
        <tr><td>Rename selected file</td><td>F2</td></tr>
        <tr><td>Delete file</td><td>Ctrl + Shift + K</td></tr>
        <tr><td>Previous / next file</td><td>Alt + ↑ / Alt + ↓</td></tr>
        <tr><td>Show / hide sidebar</td><td>Ctrl + /</td></tr>
      </table>

      <h3>Saving</h3>
      <table>
        <tr><th>Action</th><th>Shortcut</th></tr>
        <tr><td>Save locally</td><td>Ctrl + S</td></tr>
        <tr><td>Save to database</td><td>Ctrl + Shift + S</td></tr>
        <tr><td>Re-pull from database</td><td>Ctrl + Shift + E</td></tr>
      </table>

      <h3>Views</h3>
      <table>
        <tr><th>Action</th><th>Shortcut</th></tr>
        <tr><td>Editor / Split / Preview</td><td>Alt + 1 / 2 / 3</td></tr>
        <tr><td>Cycle views</td><td>Alt + V</td></tr>
        <tr><td>Next theme</td><td>Alt + T</td></tr>
        <tr><td>Leave the editor</td><td>Esc</td></tr>
      </table>

      <h3>Formatting</h3>
      <table>
        <tr><th>Action</th><th>Shortcut</th></tr>
        <tr><td>Bold</td><td>Ctrl + B</td></tr>
        <tr><td>Italic</td><td>Ctrl + I</td></tr>
        <tr><td>Inline code</td><td>Ctrl + E</td></tr>
        <tr><td>Insert link</td><td>Ctrl + Shift + L</td></tr>
        <tr><td>Indent / outdent</td><td>Tab / Shift + Tab</td></tr>
        <tr><td>Tick / untick task</td><td>Ctrl + Enter</td></tr>
        <tr><td>Move line up / down</td><td>Alt + Shift + ↑ / ↓</td></tr>
        <tr><td>Duplicate line</td><td>Alt + Shift + D</td></tr>
      </table>

      <p>This sheet: F1, or ? (outside the editor and inputs)</p>
    </dialog>
    <dialog id="appearance-dialog">
      <button type="button" id="appearance-close" class="shortcuts-close" title="Close" aria-label="Close">✕</button>
      <h2>Appearance</h2>

      <label class="field">
        Theme
        <select id="theme-select">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <label class="field">
        Font
        <select id="font-select">
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select>
      </label>
    </dialog>
    <dialog id="auth-dialog">
      <button type="button" id="auth-dialog-close" class="shortcuts-close" title="Close" aria-label="Close">✕</button>
      <p id="auth-dialog-message"></p>
      <div id="auth-dialog-content"></div>
    </dialog>
    <dialog id="export-dialog">
      <button type="button" id="export-dialog-close" class="shortcuts-close" title="Close" aria-label="Close">✕</button>
      <h2>Export notes</h2>
      <div id="export-note-list"></div>
      <fieldset>
        <legend>Format</legend>
        <label>
          <input type="radio" name="export-mode" value="separate" checked />
          Separate files
        </label>
        <label>
          <input type="radio" name="export-mode" value="zip" />
          Zip archive
        </label>
      </fieldset>
      <button type="button" id="export-confirm">Export</button>
    </dialog>
    <div id="toast-container"></div>
  `;

  const shell = root.querySelector<HTMLElement>(".app-shell")!;
  const sidebarRoot = root.querySelector<HTMLElement>("#sidebar")!;
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

  let mode: ViewMode = "editor";
  let activeId: string | null = null;
  let sidebarHandles!: SidebarHandles;
  let sidebarHidden = false;
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

  function toggleSidebar() {
    sidebarHidden = !sidebarHidden;
    shell.dataset.sidebarHidden = String(sidebarHidden);
    sidebarToggleButton.setAttribute("aria-pressed", String(!sidebarHidden));
  }

  function toggleShortcutsDialog() {
    if (shortcutsDialog.open) shortcutsDialog.close();
    else shortcutsDialog.showModal();
  }

  function openExportDialog() {
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
    updateAuthIndicator();
    authDialog.close();

    // Auto-pull on every successful login, per the README's sync design
    // ("sign in on any device and your notes are there") — then resume
    // whatever else was pending (e.g. a push blocked by a 401).
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
    updateAuthIndicator();
  }

  const THEME_ORDER: Theme[] = ["system", "light", "dark"];

  function cycleTheme() {
    const current = (document.documentElement.dataset.theme as Theme) || "system";
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    applyTheme(next);
    themeSelect.value = next;
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

  function setSaveState(state: SaveState) {
    hasUnsavedWork = state === "saving";
    statusDot.dataset.state = state;
    statusText.textContent = state === "saving" ? "Saving…" : "Saved";
  }

  function handleDocChange(doc: string) {
    if (!activeId) return;
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
        syncMessage.textContent = `Push failed: ${err instanceof Error ? err.message : "unknown error"}`;
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
        syncMessage.textContent = `Pull failed: ${err instanceof Error ? err.message : "unknown error"}`;
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
    const created = await store.importFiles(files);
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

  pushButton.addEventListener("click", () => void handlePush());
  pullButton.addEventListener("click", () => void handlePull());
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
    onImportFiles: (files) => void importFiles(files),
    onExportRequest: () => openExportDialog(),
    onRename: (id, title) => void store.rename(id, title),
    onAuthAction: () => {
      if (currentUser) void handleLogout();
      else openAuthDialog("Log in to sync your notes.");
    },
  });

  root
    .querySelector<HTMLButtonElement>("#shortcuts-button")!
    .addEventListener("click", () => toggleShortcutsDialog());

  root
    .querySelector<HTMLButtonElement>("#shortcuts-close")!
    .addEventListener("click", () => shortcutsDialog.close());

  shortcutsDialog.addEventListener("click", (event) => {
    if (event.target === shortcutsDialog) shortcutsDialog.close();
  });

  root
    .querySelector<HTMLButtonElement>("#export-dialog-close")!
    .addEventListener("click", () => exportDialog.close());

  exportDialog.addEventListener("click", (event) => {
    if (event.target === exportDialog) exportDialog.close();
  });

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
  themeSelect.value = document.documentElement.dataset.theme ?? "system";
  fontSelect.value = document.documentElement.dataset.font ?? "sans";

  appearanceButton.addEventListener("click", () => {
    if (appearanceDialog.open) appearanceDialog.close();
    else appearanceDialog.showModal();
  });

  root
    .querySelector<HTMLButtonElement>("#appearance-close")!
    .addEventListener("click", () => appearanceDialog.close());

  appearanceDialog.addEventListener("click", (event) => {
    if (event.target === appearanceDialog) appearanceDialog.close();
  });

  themeSelect.addEventListener("change", () =>
    applyTheme(themeSelect.value as Theme),
  );
  fontSelect.addEventListener("change", () =>
    applyFont(fontSelect.value as Font),
  );

  root
    .querySelector<HTMLButtonElement>("#auth-dialog-close")!
    .addEventListener("click", () => {
      pendingAfterAuth = null;
      authDialog.close();
    });

  authDialog.addEventListener("click", (event) => {
    if (event.target === authDialog) {
      pendingAfterAuth = null;
      authDialog.close();
    }
  });

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
    const nextSource = toggleTaskInSource(
      view.state.doc.toString(),
      taskIndex,
    );
    if (nextSource === null) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextSource },
    });
  });

  // Synced scrolling in split mode, guarded against feedback loops.
  let syncingScroll = false;

  function proportionalScroll(source: HTMLElement, target: HTMLElement) {
    const sourceRange = source.scrollHeight - source.clientHeight;
    if (sourceRange <= 0) return;
    const ratio = source.scrollTop / sourceRange;
    const targetRange = target.scrollHeight - target.clientHeight;
    target.scrollTop = ratio * targetRange;
  }

  view.scrollDOM.addEventListener("scroll", () => {
    if (mode !== "split" || syncingScroll) return;
    syncingScroll = true;
    proportionalScroll(view.scrollDOM, previewPane);
    syncingScroll = false;
  });

  previewPane.addEventListener("scroll", () => {
    if (mode !== "split" || syncingScroll) return;
    syncingScroll = true;
    proportionalScroll(previewPane, view.scrollDOM);
    syncingScroll = false;
  });

  // Drag the divider between editor and preview in split mode (VS
  // Code-style resizable split) — sets the editor pane's share of the
  // row as a percentage; the preview pane just fills what's left.
  const MIN_PANE_RATIO = 0.15;
  const MAX_PANE_RATIO = 0.85;

  function setSplitRatio(ratio: number) {
    const clamped = Math.min(MAX_PANE_RATIO, Math.max(MIN_PANE_RATIO, ratio));
    editorPane.style.flex = `0 0 ${clamped * 100}%`;
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

  function isEditableTarget(el: Element | null): boolean {
    if (!el) return false;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
    return el instanceof HTMLElement && el.isContentEditable;
  }

  // Every app-level shortcut (Files/Saving/Views/Help) lives in one
  // capture-phase document listener, so it wins over whatever has focus —
  // the editor, the sidebar search box, the rename field — matching the
  // README's stated shortcut architecture. Formatting shortcuts (bold,
  // italic, task toggle, line move, etc.) stay inside CodeMirror's own
  // keymap since they only make sense with editor focus.
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

      // Help
      if (key === "F1" && !mod && !alt && !shift) {
        handle();
        toggleShortcutsDialog();
        return;
      }
      if (key === "?" && !mod && !alt && !isEditableTarget(document.activeElement)) {
        handle();
        toggleShortcutsDialog();
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

  // Bulk import via drag-and-drop anywhere on the window (README: "pick
  // several .md files at once, or drag and drop them anywhere onto the
  // window"). dragover must call preventDefault() or the browser refuses
  // the drop entirely and just navigates to/opens the file instead.
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

    const mdFiles = Array.from(event.dataTransfer.files).filter(
      (file) => file.name.toLowerCase().endsWith(".md"),
    );
    if (mdFiles.length > 0) void importFiles(mdFiles);
  });

  async function bootstrap() {
    await store.load();
    if (store.list().length === 0) {
      await store.create(DEMO_DOC, "Welcome to MD");
    }

    const first = store.list()[0];
    if (first) {
      activeId = first.id;
      loadIntoEditor(first.content);
    }
    refreshSidebar();

    // Silent check: not being logged in is a normal default state (auth
    // is only needed to sync), so a failure here just leaves currentUser
    // null instead of surfacing an error.
    try {
      currentUser = await me();
    } catch {
      currentUser = null;
    }
    updateAuthIndicator();
  }

  void bootstrap();

  applyMode();
}
