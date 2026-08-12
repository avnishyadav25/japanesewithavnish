/**
 * Remotion entry point. Kept at the repo root, separate from `src/remotion/` (which holds the
 * actual components), so the Next build never pulls `registerRoot` — a render-only API — into
 * the app bundle. The admin's <Player> imports `src/remotion/VideoRoot` directly instead.
 */
import { registerRoot } from "remotion";
import { RemotionRoot } from "../src/remotion/Root";

registerRoot(RemotionRoot);
