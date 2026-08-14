/**
 * The persistent brand marks: logo top-right, hashtag bottom-centre.
 *
 * Mounted once in VideoRoot above every scene rather than inside `SceneFrame`, so no scene
 * component has to know branding exists and a new scene type gets it for free.
 *
 * Two placement constraints, both measured rather than guessed:
 *
 *   - Captions sit at `scale.pad * 2.4` from the bottom at 9:16 (211px) and `* 1.1` at 16:9
 *     (106px). The hashtag sits at `* 0.55` (~48px), clearing both.
 *   - The hashtag uses the same translucent-dark pill as the captions. A plain dark-text mark
 *     disappears against the red outro and against bright b-roll; the pill reads on the light
 *     theme, the dark theme and a screenshot alike.
 *
 * `staticFile()` resolves against `public/`, which is what both `remotion.config.ts` and
 * `scripts/lib/video/render.ts` configure as the Remotion public dir — so the Studio preview,
 * the admin <Player> and the headless render all load the same file.
 */
import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import type { BrandingSettings, ResolvedTimeline, Scene } from "@/lib/video/types";
import { logoAsset } from "@/lib/video/branding";
import { mascotForScene } from "@/lib/video/mascots";
import { CornerMascot } from "../scenes/MascotScenes";
import { useLayout } from "../LayoutContext";
import { fontStackSans } from "../theme";

/** Scene types that render their own brand lockup and must not also get the corner watermark. */
const SUPPRESS_LOGO_ON: ReadonlySet<string> = new Set(["cta_outro"]);

export const BrandOverlay: React.FC<{
  branding: BrandingSettings;
  /** Square and vertical carry the hashtag; landscape gets the logo only. */
  showHashtag: boolean;
  scenes: Scene[];
  timeline: ResolvedTimeline;
}> = ({ branding, showHashtag, scenes, timeline }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();

  // The overlay sits outside the per-scene <Sequence>s, so it has to work out which scene is on
  // screen itself. Read from the same resolved spans the sequences use rather than recomputing —
  // a rounding difference here would make the watermark blink one frame early at a boundary.
  const index = timeline.sceneFrameSpans.findIndex(([start, end]) => frame >= start && frame < end);
  const currentScene = index >= 0 ? scenes[index] : undefined;
  const sceneStartFrame = index >= 0 ? timeline.sceneFrameSpans[index][0] : 0;

  const suppressLogo = currentScene ? SUPPRESS_LOGO_ON.has(currentScene.sceneType) : false;

  // Cast by subject, so the owl always teaches grammar and the fox always does vocabulary.
  // Rendered here rather than inside each scene component: a new scene type gets one for free.
  const cornerMascot = branding.mascots && currentScene ? mascotForScene(currentScene.sceneType) : null;
  const asset = logoAsset(branding);
  const logoSize = scale.pad * 1.6;

  return (
    <>
      {cornerMascot && <CornerMascot mascot={cornerMascot} sceneStartFrame={sceneStartFrame} />}

      {asset && !suppressLogo ? (
        <Img
          src={staticFile(asset)}
          style={{
            position: "absolute",
            top: scale.pad * 0.6,
            right: scale.pad * 0.6,
            width: logoSize,
            height: logoSize,
            objectFit: "contain",
            opacity: branding.logoOpacity,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {showHashtag && branding.hashtag ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: scale.pad * 0.55,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: fontStackSans(theme),
              fontSize: scale.caption * 0.62,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.92)",
              background: "rgba(12,12,12,0.55)",
              padding: `${scale.caption * 0.2}px ${scale.caption * 0.52}px`,
              borderRadius: 999,
            }}
          >
            {branding.hashtag}
          </div>
        </div>
      ) : null}
    </>
  );
};
