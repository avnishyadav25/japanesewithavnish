/**
 * Shared webpack override for Remotion.
 *
 * Scene components live in `src/remotion/` and import shared types from `@/lib/video/*`.
 * Remotion bundles that tree with its own webpack config, which knows nothing about Next's
 * tsconfig `paths`, so the `@` alias has to be re-declared here. Both entry points use it:
 * `remotion.config.ts` (Studio / CLI) and the worker's `bundle()` call — if they diverged, the
 * preview and the render would resolve different modules.
 */
import path from "path";
import type { WebpackOverrideFn } from "@remotion/bundler";

export const webpackOverride: WebpackOverrideFn = (currentConfig) => ({
  ...currentConfig,
  resolve: {
    ...currentConfig.resolve,
    alias: {
      ...(currentConfig.resolve?.alias ?? {}),
      "@": path.join(process.cwd(), "src"),
    },
  },
});
