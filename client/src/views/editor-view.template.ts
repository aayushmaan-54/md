import { icon } from "../lib/icons";

export function buildShellHtml(): string {
  return `
    <div class="app-shell">
      <header class="app-header">
        <button
          type="button"
          class="icon-btn"
          id="sidebar-toggle"
          title="Show/hide sidebar"
          aria-pressed="true"
        >${icon("menu")}</button>
        <div class="seg mode-switcher" role="group" aria-label="View mode">
          <button type="button" data-mode="editor"><span class="wide">Editor</span><span class="narrow">Edit</span></button>
          <button type="button" data-mode="split"><span class="wide">Split</span><span class="narrow">Both</span></button>
          <button type="button" data-mode="preview"><span class="wide">Preview</span><span class="narrow">View</span></button>
        </div>
        <div class="spacer"></div>
        <div class="save-status" id="save-status" data-state="saved">
          <span class="status-dot" id="status-dot" data-state="saved"></span>
          <span id="status-text">Ready</span>
        </div>
        <button type="button" class="icon-btn" id="image-upload-button" title="Insert image">${icon("image")}</button>
        <input type="file" id="image-upload-input" accept="image/*" multiple hidden />
        <button type="button" class="icon-btn" id="pdf-export-button" title="Export to PDF">${icon("printer")}</button>
        <button type="button" class="icon-btn" id="appearance-button" title="Settings">${icon("settings")}</button>
      </header>
      <div class="app-middle">
        <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
        <aside class="sidebar" id="sidebar"></aside>
        <main class="app-body">
          <div class="editor-pane" id="editor-pane"></div>
          <div class="split-divider" id="split-divider"></div>
          <div class="preview-pane markdown-content" id="preview-pane"></div>
        </main>
      </div>
      <footer class="app-footer">
        <span class="doc-stats" id="doc-stats">0 words · 0 chars</span>
        <div class="sync-controls">
          <span class="sync-message" id="sync-message"></span>
          <button type="button" class="ghost-btn" id="pull-button">${icon("cloud-down")} Pull</button>
          <button type="button" class="ghost-btn" id="push-button">${icon("cloud-up")} Push</button>
          <button type="button" class="ghost-btn wide" id="shortcuts-button" title="Keyboard shortcuts">${icon("help")} Shortcuts</button>
        </div>
      </footer>
    </div>
    <dialog id="shortcuts-dialog">
      <button type="button" id="shortcuts-close" class="shortcuts-close" title="Close" aria-label="Close">${icon("x")}</button>
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
        <tr><td>Resize split (or double-click the divider to reset)</td><td>Alt + Shift + ← / →</td></tr>
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
      <button type="button" id="appearance-close" class="shortcuts-close" title="Close" aria-label="Close">${icon("x")}</button>
      <h2>Settings</h2>
      <p class="sub">Saved on this device.</p>

      <label class="field">
        Theme
        <select id="theme-select" class="pick full">
          <option value="sage">Sage — light</option>
          <option value="iris">Iris — light</option>
          <option value="frost">Frost — light</option>
          <option value="paper">Paper — light</option>
          <option value="sepia">Sepia — light</option>
          <option value="pine">Pine — dark</option>
          <option value="carbon">Carbon — dark</option>
          <option value="plum">Plum — dark</option>
          <option value="oled">OLED — dark</option>
        </select>
      </label>

      <label class="field">
        Font
        <select id="font-select" class="pick full">
          <option value="jbmono">JetBrains Mono</option>
          <option value="plex">IBM Plex Mono</option>
          <option value="inter">Inter</option>
          <option value="system">System Sans</option>
          <option value="serif">Source Serif 4</option>
          <option value="dyslexic">OpenDyslexic</option>
        </select>
      </label>

      <label class="field">
        Tab width
        <select id="tab-width-select" class="pick full">
          <option value="2">2 spaces</option>
          <option value="4" selected>4 spaces</option>
          <option value="8">8 spaces</option>
          <option value="tab">Tab character</option>
        </select>
      </label>

      <div class="row">
        <button type="button" class="btn" id="settings-import-button">${icon("import")} Import .md / .zip</button>
        <button type="button" class="btn" id="settings-export-button">${icon("export")} Export…</button>
      </div>
      <input type="file" id="note-import-input" accept=".md,text/markdown,.zip,application/zip" multiple hidden />
    </dialog>
    <dialog id="auth-dialog">
      <button type="button" id="auth-dialog-close" class="shortcuts-close" title="Close" aria-label="Close">${icon("x")}</button>
      <p id="auth-dialog-message"></p>
      <div id="auth-dialog-content"></div>
    </dialog>
    <dialog id="export-dialog">
      <button type="button" id="export-dialog-close" class="shortcuts-close" title="Close" aria-label="Close">${icon("x")}</button>
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
    <dialog id="confirm-dialog">
      <h2 id="confirm-title"></h2>
      <p id="confirm-message"></p>
      <div class="row">
        <button type="button" class="btn" id="confirm-cancel">Cancel</button>
        <button type="button" class="btn" id="confirm-ok">Confirm</button>
      </div>
    </dialog>
    <div id="toast-container"></div>
  `;
}
