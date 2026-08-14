/**
 * The opening beat.
 *
 * A mascot walks in waving, greets the viewer in Japanese, and the topic lands. It exists for
 * the first second of a Reel, which is the only second most viewers give a video — a character
 * moving is a stronger hook than a title fading up.
 *
 * Motion is spring-driven through Remotion's `frame`, never CSS: the render steps Chrome frame
 * by frame, and a wall-clock animation would land somewhere different on every pass.
 */
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { MascotIntroVisual } from "@/lib/video/types";
import { mascotAsset, type MascotId } from "@/lib/video/mascots";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans, fontStackSerif } from "../theme";
import { Eyebrow, FadeUp, SceneFrame } from "../components/primitives";

export const MascotIntroScene: React.FC<{ visual: MascotIntroVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The character arrives with a bit of overshoot, then a slow idle bob so a 2.5-second hold
  // never reads as a frozen frame.
  const entrance = spring({ frame, fps, config: { damping: 12, mass: 0.7, stiffness: 110 } });
  const bob = Math.sin((frame / fps) * 2.2) * scale.gap * 0.12;
  const size = scale.displayJa * 2.1;

  return (
    <SceneFrame justify="center">
      <div style={{ display: "grid", justifyItems: "center", gap: scale.gap * 0.5 }}>
        <div
          style={{
            transform: `translateY(${interpolate(entrance, [0, 1], [scale.gap * 3, 0]) + bob}px) scale(${interpolate(
              entrance,
              [0, 1],
              [0.82, 1]
            )})`,
            opacity: interpolate(entrance, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <Img
            src={staticFile(mascotAsset(visual.mascot as MascotId))}
            style={{ width: size, height: size, objectFit: "contain" }}
          />
        </div>

        <FadeUp delay={10}>
          <div
            style={{
              fontFamily: fontStackJa(theme),
              fontSize: scale.title,
              fontWeight: 700,
              color: theme.text,
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            {visual.greeting}
          </div>
        </FadeUp>

        {visual.greetingRomaji && (
          <FadeUp delay={14}>
            <div
              style={{
                fontFamily: fontStackSans(theme),
                fontSize: scale.caption * 0.9,
                color: theme.textMuted,
                textAlign: "center",
                letterSpacing: "0.04em",
              }}
            >
              {visual.greetingRomaji}
            </div>
          </FadeUp>
        )}

        {visual.eyebrow && (
          <FadeUp delay={20}>
            <Eyebrow>{visual.eyebrow}</Eyebrow>
          </FadeUp>
        )}

        <FadeUp delay={24}>
          <div
            style={{
              fontFamily: fontStackSerif(theme),
              fontSize: scale.headline * 0.78,
              fontWeight: 700,
              color: theme.text,
              textAlign: "center",
              lineHeight: 1.12,
            }}
          >
            {visual.topic}
          </div>
        </FadeUp>
      </div>
    </SceneFrame>
  );
};

/**
 * The small character in the corner of a teaching scene.
 *
 * Bottom-LEFT deliberately: the logo watermark is top-right, the captions are centred, and the
 * hashtag is bottom-centre — the left corner is the only quadrant with nothing in it.
 *
 * Rendered by BrandOverlay rather than by each scene, so a new scene type gets one for free and
 * no scene component has to know mascots exist.
 */
export const CornerMascot: React.FC<{ mascot: MascotId; sceneStartFrame: number }> = ({ mascot, sceneStartFrame }) => {
  const { scale } = useLayout();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Keyed off the scene's own start, so the character re-enters when the scene changes rather
  // than sliding in once at the top of the video and sitting there.
  const local = frame - sceneStartFrame;
  const entrance = spring({ frame: local, fps, config: { damping: 18, mass: 0.6 } });
  const size = scale.displayJa * 0.95;

  return (
    <div
      style={{
        position: "absolute",
        left: scale.pad * 0.35,
        bottom: scale.pad * 1.25,
        width: size,
        height: size,
        opacity: interpolate(entrance, [0, 1], [0, 0.96]),
        transform: `translateX(${interpolate(entrance, [0, 1], [-size * 0.4, 0])}px)`,
        pointerEvents: "none",
      }}
    >
      <Img src={staticFile(mascotAsset(mascot))} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
};
