# MD.
**A local-first Markdown workspace built for writing things down quickly and getting out of the way.**
Open. Write. Save. Move on.

---

## Principles
- **Local-first** — notes are available instantly and work without waiting on a server.
- **Keyboard-first** — navigate, create, search, and manage notes without reaching for the mouse.
- **Editor-focused** — a clean Markdown editor with nothing competing for your attention.
- **Quick capture** — thoughts, todos, ideas, requirements, research. Write them down before you forget.
- **Optional sync** — local by default; pushed to the database only when you ask.
- **Fast** — no framework runtime, no build step in the way of first paint.
- **Accessible** — full keyboard operation, real focus states.

---

## Features
### Editor
- **Distraction-free chrome** — the header and footer fade to low opacity while you type, and return on mouse move.
- **Smart lists** — bullets, blockquote, numbered items, and task items all continue on `Enter`. Numbered lists auto-increment, task items carry over unchecked, indentation is preserved, and an empty item exits the list.
- **Block indent** — `Tab` and `Shift` + `Tab` indent and outdent whole selections, respecting the configured tab width.
- **Task toggle** — tick or untick a checkbox in place, without moving the caret.
- **Line manipulation** — move the current line or selection up and down, or duplicate it.
- **Smart paste** — a URL pasted over selected text becomes `[selection](url)` instead of replacing it.
- **Auto-surround** — select text and press `(` `[` `{` `"` `'` `` ` `` `*` `_` `~` to wrap the selection instead of replacing it.
- **Syntax highlighting in the editor** — fenced code blocks are highlighted while you type, VS Code-style, using a highlight layer beneath a caret-transparent textarea. No contenteditable, no rich text.
- **Undo/redo integrity** — every smart edit (list continuation, auto-surround, line moves, task toggle) is a single undo step, never character-by-character.
- **Images** — paste or upload images into a note. A brief loader shows while the image is re-encoded to **lossless WebP** (smaller file, zero quality loss) before insertion. Stored locally as blobs, and uploaded to the server as separate objects (not part of the note-sync payload); subject to a per-account storage quota enforced atomically at upload time.
- **IME-safe** — key handling is suspended during input-method composition, so Hindi/Japanese/Korean typing is never hijacked.
- **Soft-wrapped** plain text — no rich text, no block editor.
- **Configurable tab width** — 2, 4, 8 spaces, or a real tab character.

### Views
- **Three modes** — Editor, Split, Preview. Editor is the default.
- **Synchronized scrolling** — both panes stay in step in Split view.
- **Scroll position preserved** across note switches and view toggles.
- **Preview rendering** — fenced code blocks with syntax highlighting, GitHub-style task lists with clickable checkboxes (toggling updates the source), and tables. Embedded HTML is sanitized: a `.md` file can never execute script.

### Files
- **Multiple notes**, each stored separately.
- **Derived titles** — a new note is *Untitled*, then takes its name from the document's first heading.
- **Manual rename** overrides the derived title permanently.

### Search
- **Client-side filtering** by file name. No index, no server round trip.

### Appearance
- **Themes and fonts**, chosen by the user and persisted in IndexedDB.

### Storage
- **IndexedDB by default** — writes are local and optimistic.
- **Debounced autosave** with a **save-status indicator**.
- **Unsaved-changes guard** — warns before closing or reloading with unsaved edits, and while a push is in flight.
- **The local copy is the working copy.** The database is a checkpoint, never a live backend. Nothing on the network is on the critical path for typing, switching notes, or saving.
- **Per-account image quota** — images count toward a **25 MB** allowance per account; the quota is checked client-side before insert (post-conversion size) and server-side, atomically, at upload time.

### Sync
- **Auto-pull on login** — sign in on any device and your notes are there. Pull is additive: collisions get a Windows-style suffix (`Note 2`), nothing is ever silently overwritten or deleted.
- **Explicit push, per note** — `Save to database` writes only the notes you changed to the server as a checkpoint. Each note is synced whole (no partial/diff updates) and wins or conflicts independently — editing two different notes on two different devices never conflicts with itself.
- **Deletes are explicit only** — deleting a note removes it from the server directly; sync never deletes a note as a side effect of push or pull, and deletes don't propagate to other devices on their own.
- **Conflict-safe, per note** — each note carries its own version number; a stale push for that note is rejected rather than overwriting newer data, without affecting the rest of the notes in the same sync.
**Known limitations** (by design): editing the same note on two devices still yields a conflict to resolve, just scoped to that note; old server versions are not retained; deletes don't propagate between devices.

### Auth
- **Optional** — only required to sync.
- **Username and password only** — no OAuth, no magic links.
- **No third-party auth service** — a session is just a secure, unguessable cookie; nothing is ever stored in browser JS, and there's no external identity provider to configure. See [server/README.md](server/README.md) for how sessions actually work under the hood.

### Import and export
- **Bulk import** — pick several `.md` files at once, or drag and drop them anywhere onto the window.
- **Export picker** — choose which notes to export, then take them as separate files or joined into one. Notes with images export alongside an `images/` folder, with the Markdown referencing them by relative path — the exported folder is self-contained.
- **PDF export** — print-optimized stylesheet; export any note to PDF through the browser's print dialog.

### Footer
- **Shortcut cheat sheet** in a popover.
- **Editor preferences** such as tab width.

---

## Shortcuts
`Ctrl` maps to `Cmd` on macOS. Nothing uses `Ctrl` + `Alt`, since Windows sends that combination when European layouts press **AltGr**.
All shortcuts are handled by a single capture-phase `keydown` listener on `document`, which calls `preventDefault()` for every handled combo before any text insertion can happen — this covers plain inputs and the rename field, not just the editor. No binding uses a browser-reserved shortcut (`Ctrl` + `T` / `N` / `W` / `Tab`), so every conflict is fully interceptable.

**Platform caveats:**
- **macOS** — `F1` / `F2` are brightness keys unless *"Use F1, F2 as standard function keys"* is enabled (or hold `Fn`). `Option` + Arrow is native word navigation; it is intercepted here, but users may notice the difference outside the app.
- **Windows** — `Alt` + `Shift` is the default keyboard-layout switcher on many installs. The layout hotkey may fire alongside `Move line` / `Duplicate line`; this happens at OS level and cannot be prevented by the page.

### Files
| Action | Shortcut |
| --- | --- |
| Search files | `Ctrl` + `K` |
| New file | `Alt` + `N` |
| Rename selected file | `F2` |
| Delete file | `Ctrl` + `Shift` + `K` |
| Previous / next file | `Alt` + `↑` / `Alt` + `↓` |
| Show / hide sidebar | `Ctrl` + `/` |

### Saving
| Action | Shortcut |
| --- | --- |
| Save locally | `Ctrl` + `S` |
| Save to database | `Ctrl` + `Shift` + `S` |
| Re-pull from database | `Ctrl` + `Shift` + `E` |

### Views
| Action | Shortcut |
| --- | --- |
| Editor / Split / Preview | `Alt` + `1` / `2` / `3` |
| Cycle views | `Alt` + `V` |
| Next theme | `Alt` + `T` |
| Leave the editor | `Esc` |

### Formatting
| Action | Shortcut |
| --- | --- |
| Bold | `Ctrl` + `B` |
| Italic | `Ctrl` + `I` |
| Inline code | `Ctrl` + `E` |
| Insert link | `Ctrl` + `Shift` + `L` |
| Indent / outdent | `Tab` / `Shift` + `Tab` |
| Tick / untick task | `Ctrl` + `Enter` |
| Move line up / down | `Alt` + `Shift` + `↑` / `↓` |
| Duplicate line | `Alt` + `Shift` + `D` |

### Help
| Action | Shortcut |
| --- | --- |
| Shortcut sheet | `F1` or `?` (only when focus is outside the editor and inputs) |

---

## Project layout

This is two independently deployable pieces, each documented on its own terms — this file stays about what the app *is and does*, not how either half is built:

- **[`client/`](client/README.md)** — the app itself. Vite + TypeScript, no framework. Local-first: IndexedDB is the source of truth, the server is a checkpoint.
- **[`server/`](server/README.md)** — the sync/auth/image API. Cloudflare Workers + Hono, Postgres (Neon) via Drizzle, Upstash Redis for session caching, R2 for image storage.

Read those two for tech stack, environment setup, scripts, and deploy notes.
