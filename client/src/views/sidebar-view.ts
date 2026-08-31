import type { Note } from "../notes/model";
import type { User } from "../api/auth";
import { escapeHtml } from "../lib/html";

export type SidebarCallbacks = {
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onImportFiles: (files: FileList) => void;
  onExportRequest: () => void;
  onRename: (id: string, title: string) => void;
  onAuthAction: () => void;
};

export type SidebarHandles = {
  refresh: (notes: Note[], activeId: string | null) => void;
  focusSearch: () => void;
  renameActive: () => void;
  setAuthStatus: (user: User | null) => void;
};

export function renderSidebar(
  root: HTMLElement,
  callbacks: SidebarCallbacks,
): SidebarHandles {
  root.innerHTML = `
    <div class="sidebar-toolbar">
      <button type="button" data-action="new" title="New note">➕ New</button>
      <button type="button" data-action="import" title="Import notes">📥 Import</button>
      <button type="button" data-action="export" title="Export notes">📤 Export</button>
    </div>
    <input type="search" id="note-search" placeholder="🔍 Search notes" />
    <ul class="note-list" id="note-list"></ul>
    <div class="sidebar-footer" id="sidebar-count">0 files</div>
    <div class="sidebar-auth" id="sidebar-auth">
      <span id="auth-status-text">👤 Not logged in</span>
      <button type="button" id="auth-action-button">Log in</button>
    </div>
    <input
      type="file"
      id="note-import-input"
      accept=".md,text/markdown"
      multiple
      hidden
    />
  `;

  const list = root.querySelector<HTMLUListElement>("#note-list")!;
  const countEl = root.querySelector<HTMLElement>("#sidebar-count")!;
  const searchInput = root.querySelector<HTMLInputElement>("#note-search")!;
  const importInput = root.querySelector<HTMLInputElement>(
    "#note-import-input",
  )!;
  const authStatusText = root.querySelector<HTMLElement>(
    "#auth-status-text",
  )!;
  const authActionButton = root.querySelector<HTMLButtonElement>(
    "#auth-action-button",
  )!;

  authActionButton.addEventListener("click", () => callbacks.onAuthAction());

  root
    .querySelector<HTMLButtonElement>('[data-action="new"]')!
    .addEventListener("click", () => callbacks.onNew());

  root
    .querySelector<HTMLButtonElement>('[data-action="import"]')!
    .addEventListener("click", () => importInput.click());

  root
    .querySelector<HTMLButtonElement>('[data-action="export"]')!
    .addEventListener("click", () => callbacks.onExportRequest());

  importInput.addEventListener("change", () => {
    if (importInput.files && importInput.files.length > 0) {
      callbacks.onImportFiles(importInput.files);
    }
    importInput.value = "";
  });

  function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();
    for (const item of Array.from(list.querySelectorAll<HTMLLIElement>("li"))) {
      const title = item.dataset.title ?? "";
      item.hidden = query.length > 0 && !title.includes(query);
    }
  }

  searchInput.addEventListener("input", applyFilter);

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const deleteButton = target.closest<HTMLElement>('[data-action="delete"]');
    if (deleteButton) {
      const id = deleteButton.closest<HTMLLIElement>("li")?.dataset.noteId;
      if (id) callbacks.onDelete(id);
      return;
    }

    const item = target.closest<HTMLLIElement>("li");
    if (item?.dataset.noteId) callbacks.onSelect(item.dataset.noteId);
  });

  list.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest(".note-item")) return;

    const li = target.closest<HTMLLIElement>("li");
    const id = li?.dataset.noteId;
    if (!li || !id) return;

    startRename(li, id, li.dataset.titleRaw ?? "", callbacks);
  });

  function refresh(notes: Note[], activeId: string | null) {
    updateSidebarList(list, notes, activeId);
    applyFilter();
    countEl.textContent = `${notes.length} file${notes.length === 1 ? "" : "s"}`;
  }

  function focusSearch() {
    searchInput.focus();
    searchInput.select();
  }

  function renameActive() {
    const li = list.querySelector<HTMLLIElement>('li[aria-current="true"]');
    const id = li?.dataset.noteId;
    if (!li || !id) return;
    startRename(li, id, li.dataset.titleRaw ?? "", callbacks);
  }

  function setAuthStatus(user: User | null) {
    if (user) {
      authStatusText.textContent = `👤 ${user.username}`;
      authActionButton.textContent = "Log out";
    } else {
      authStatusText.textContent = "👤 Not logged in";
      authActionButton.textContent = "Log in";
    }
  }

  return { refresh, focusSearch, renameActive, setAuthStatus };
}

function startRename(
  li: HTMLLIElement,
  id: string,
  currentTitle: string,
  callbacks: SidebarCallbacks,
) {
  const originalContent = li.innerHTML;
  li.innerHTML = `<input type="text" class="note-rename-input" value="${escapeHtml(currentTitle)}" />`;

  const input = li.querySelector<HTMLInputElement>(".note-rename-input")!;
  input.focus();
  input.select();

  let settled = false;

  function restore() {
    li.innerHTML = originalContent;
  }

  function commit() {
    if (settled) return;
    settled = true;
    const value = input.value.trim();
    if (value && value !== currentTitle) callbacks.onRename(id, value);
    else restore();
  }

  function cancel() {
    if (settled) return;
    settled = true;
    restore();
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", commit);
}

function updateSidebarList(
  list: HTMLUListElement,
  notes: Note[],
  activeId: string | null,
): void {
  list.innerHTML = notes
    .map((note) => {
      const title = escapeHtml(note.title);
      return `
        <li
          data-note-id="${note.id}"
          data-title="${escapeHtml(note.title.toLowerCase())}"
          data-title-raw="${escapeHtml(note.title)}"
          aria-current="${note.id === activeId}"
        >
          <button type="button" class="note-item">📄 ${title}</button>
          <button type="button" data-action="delete" title="Delete note">🗑️</button>
        </li>
      `;
    })
    .join("");
}
