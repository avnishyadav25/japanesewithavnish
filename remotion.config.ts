/**
 * Remotion CLI/Studio config. The render worker does NOT read this file (renderMedia takes its
 * options programmatically) — it only affects `npx remotion studio` and `npx remotion render`,
 * which are the local design/debug loop. Keep the codec and image-format choices here in sync
 * with scripts/lib/video/render.ts.
 */
import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./remotion/webpackOverride";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.overrideWebpackConfig(webpackOverride);
