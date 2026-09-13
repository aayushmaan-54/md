import "./style.css";
import { renderEditorView } from "./views/editor-view";
import { initAppearance } from "./lib/appearance";
import { preloadShiki } from "./preview/shiki";

const app = document.querySelector<HTMLDivElement>("#app")!;

async function bootstrap() {
  await initAppearance();
  renderEditorView(app);

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(preloadShiki);
  } else {
    setTimeout(preloadShiki, 1000);
  }
}

void bootstrap();
