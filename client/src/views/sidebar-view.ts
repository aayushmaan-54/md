import type { Note } from "../notes/model";
import type { User } from "../api/auth";
import { escapeHtml } from "../lib/html";
import { icon } from "../lib/icons";

export type SidebarCallbacks = {
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
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
    <div class="side-top">
      <input type="search" id="note-search" class="filter" placeholder="Search notes  (Ctrl+K)" aria-label="Filter notes" />
      <button type="button" class="add" data-action="new" title="New note (Alt+N)" aria-label="New note">${icon("plus")}</button>
    </div>
    <ul class="note-list" id="note-list"></ul>
    <div class="sidebar-footer">
      <span id="sidebar-count">0 files</span>
      <span>F1 for keys</span>
    </div>
    <div class="sidebar-auth" id="sidebar-auth">
      <span id="auth-status-text">${icon("user")} Not logged in</span>
      <button type="button" class="fbtn" id="auth-action-button">Log in</button>
    </div>
  `;

  const list = root.querySelector<HTMLUListElement>("#note-list")!;
  const countEl = root.querySelector<HTMLElement>("#sidebar-count")!;
  const searchInput = root.querySelector<HTMLInputElement>("#note-search")!;
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
    // Element, not HTMLElement: a click can land on the button's inline
    // <svg> icon, which is an SVGElement.
    if (!(target instanceof Element)) return;

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
    if (!(target instanceof Element)) return;
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
    authStatusText.innerHTML = user
      ? `${icon("user")} ${escapeHtml(user.username)}`
      : `${icon("user")} Not logged in`;
    authActionButton.textContent = user ? "Log out" : "Log in";
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
    // Restore either way: onRename resolves asynchronously, so this
    // reverts to normal markup now and the later refresh() corrects the
    // title — updateSidebarList never expects a row mid-rename.
    restore();
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

function createNoteRow(note: Note): HTMLLIElement {
  const li = document.createElement("li");
  li.dataset.noteId = note.id;
  li.innerHTML = `
    <button type="button" class="note-item"></button>
    <button type="button" class="note-delete" data-action="delete" title="Delete note">${icon("trash")}</button>
  `;
  return li;
}

// Keyed reconciliation instead of a full list.innerHTML rebuild: matches
// existing <li>s by note id and patches/moves them, so an autosave tick
// doesn't recreate every row just to re-sort or re-title one note.
function updateSidebarList(
  list: HTMLUListElement,
  notes: Note[],
  activeId: string | null,
): void {
  const existing = new Map<string, HTMLLIElement>();
  for (const child of Array.from(list.children)) {
    const li = child as HTMLLIElement;
    if (li.dataset.noteId) existing.set(li.dataset.noteId, li);
  }

  let after: HTMLLIElement | null = null;

  for (const note of notes) {
    let li = existing.get(note.id);
    if (li) existing.delete(note.id);
    else li = createNoteRow(note);

    if (li.dataset.titleRaw !== note.title) {
      li.dataset.title = note.title.toLowerCase();
      li.dataset.titleRaw = note.title;
      const titleEl = li.querySelector<HTMLElement>(".note-item");
      if (titleEl) titleEl.textContent = note.title;
    }

    const activeAttr = String(note.id === activeId);
    if (li.getAttribute("aria-current") !== activeAttr) {
      li.setAttribute("aria-current", activeAttr);
    }

    // insertBefore repositions an already-in-document node in place.
    const wantsPosition: ChildNode | null = after ? after.nextSibling : list.firstChild;
    if (li !== wantsPosition) list.insertBefore(li, wantsPosition);
    after = li;
  }

  for (const leftover of existing.values()) leftover.remove();
}
