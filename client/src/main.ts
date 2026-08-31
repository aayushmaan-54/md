import "./style.css";
import { renderEditorView } from "./views/editor-view";
import { initAppearance } from "./lib/appearance";

// Auth is temporarily disabled while the core editor (CodeMirror + Shiki +
// marked + DOMPurify) is being built — see api/auth.ts and views/{login,
// signup,dashboard}-view.ts, which are unused but left in place.
const app = document.querySelector<HTMLDivElement>("#app")!;

async function bootstrap() {
  await initAppearance();
  renderEditorView(app);
}

void bootstrap();
