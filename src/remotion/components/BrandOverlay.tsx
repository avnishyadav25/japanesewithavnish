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
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BrandingSettings, ResolvedTimeline, Scene } from "@/lib/video/types";
import { fitTitleBar, logoAsset } from "@/lib/video/branding";
import { mascotForBeat } from "@/lib/video/mascots";
import { CornerMascot } from "../scenes/MascotScenes";
import { segmentOffsets } from "@/lib/video/timeline";
import { useLayout } from "../LayoutContext";
import { fontStackSans } from "../theme";

/** Scene types that render their own brand lockup and must not also get the corner watermark. */
const SUPPRESS_LOGO_ON: ReadonlySet<string> = new Set(["cta_outro"]);

/**
 * Scenes that already say the title, so the small bar would repeat it.
 *
 * `title_card` renders it full size — a miniature copy directly above is noise. `cta_outro`
 * suppresses the logo for the same reason and gets the same treatment. `mascot_intro` shows the
 * topic under the greeting, so it is covered too.
 */
const SUPPRESS_TITLE_ON: ReadonlySet<string> = new Set(["title_card", "cta_outro", "mascot_intro"]);

export const BrandOverlay: React.FC<{
  branding: BrandingSettings;
  /** Square and vertical carry the hashtag; landscape gets the logo only. */
  showHashtag: boolean;
  /** Same format rule as the hashtag — see showsTitleBar(). */
  showTitleBar?: boolean;
  /** The video's title, for the persistent top-centre label. */
  title?: string;
  scenes: Scene[];
  timeline: ResolvedTimeline;
}> = ({ branding, showHashtag, showTitleBar, title, scenes, timeline }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The overlay sits outside the per-scene <Sequence>s, so it has to work out which scene is on
  // screen itself. Read from the same resolved spans the sequences use rather than recomputing —
  // a rounding difference here would make the watermark blink one frame early at a boundary.
  const index = timeline.sceneFrameSpans.findIndex(([start, end]) => frame >= start && frame < end);
  const currentScene = index >= 0 ? scenes[index] : undefined;
  const sceneStartFrame = index >= 0 ? timeline.sceneFrameSpans[index][0] : 0;

  const suppressLogo = currentScene ? SUPPRESS_LOGO_ON.has(currentScene.sceneType) : false;

  // Cast by subject, so the owl always teaches grammar and the fox always does vocabulary.
  // Rendered here rather than inside each scene component: a new scene type gets one for free.
  /**
   * The corner teacher, and WHICH POSE it holds right now.
   *
   * It used to be one frozen image for the whole scene, which is what made it read as a sticker
   * rather than a character. It now steps through a pose sequence as the narration moves from
   * sentence to sentence — explaining, pointing at the thing, encouraging — using the beat index
   * the overlay already computes for the camera.
   *
   * `mascotForBeat` filters through isGenerated() and falls back to the single cast pose, so this
   * changes nothing until the teaching art is promoted.
   */
  const beatIndex = currentScene
    ? Math.max(0, segmentOffsets(currentScene).filter((o) => sceneStartFrame + o * fps <= frame).length - 1)
    : 0;
  const cornerMascot =
    branding.mascots && currentScene ? mascotForBeat(currentScene.sceneType, beatIndex) : null;
  const asset = logoAsset(branding);
  const logoSize = scale.pad * 1.6;

  const suppressTitle = currentScene ? SUPPRESS_TITLE_ON.has(currentScene.sceneType) : false;
  const titleFit = title ? fitTitleBar(title) : null;

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

      {/* Small persistent title, top centre.
          Capped at 58% of the width so it cannot reach the logo, which sits top-RIGHT with a
          `pad * 0.6` inset — the same inset used here so the two align optically rather than by
          eye. Same translucent pill as the hashtag and the captions, for the reason in the file
          header: a plain dark mark vanishes against the red outro and against bright B-roll. */}
      {showTitleBar && titleFit && !suppressTitle ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: scale.pad * 0.6,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              maxWidth: "58%",
              fontFamily: fontStackSans(theme),
              fontSize: scale.caption * 0.58 * titleFit.scale,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "rgba(255,255,255,0.92)",
              background: "rgba(12,12,12,0.55)",
              padding: `${scale.caption * 0.18}px ${scale.caption * 0.48}px`,
              borderRadius: 999,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textAlign: "center",
            }}
          >
            {titleFit.text}
          </div>
        </div>
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
