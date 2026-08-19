/**
 * Draws a scene's frozen sticker.
 *
 * BEHIND THE CONTENT, ALWAYS. This mounts inside SceneFrame's background layer, under the column
 * that holds the word, the reading and the meaning. A decoration that can obscure the thing being
 * taught is worse than no decoration.
 *
 * It moves AGAINST the camera. SceneFrame pushes the content layer outward over the scene; drifting
 * the sticker the other way at a fraction of that rate reads as depth rather than as a second thing
 * sliding around. The camera scale is already in context, so this needs no new state.
 *
 * Placement is bottom-left or bottom-right, alternating by scene, chosen to miss the three things
 * that must never be covered: the logo (top-right), the top-centre title bar, and the caption band
 * across the bottom-centre.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraScaleAt } from "@/lib/video/motion";
import { useLayout, useSceneMotion } from "../LayoutContext";

export const StickerLayer: React.FC<{ decor: { slug: string; url: string; corner: "left" | "right" } }> = ({
  decor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, motion } = useLayout();
  const { beatFrames, durationInFrames } = useSceneMotion();

  const camera = cameraScaleAt(frame, durationInFrames, beatFrames, motion, fps);
  // Inverted: the content grows, the sticker recedes.
  const parallax = 1 - (camera - 1) * 0.6;

  // A slow float, and a fade-in that is complete well before the narration reaches its point.
  const bob = Math.sin((frame / fps) * 0.9) * scale.gap * 0.35;
  const entrance = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const size = scale.displayJa * 1.35;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <Img
        src={decor.url}
        alt=""
        style={{
          position: "absolute",
          // Well below centre and outside the caption's own inset, so the two never share a band.
          bottom: scale.pad * 3.4,
          [decor.corner]: -size * 0.16,
          width: size,
          height: size,
          objectFit: "contain",
          // Low enough to sit under type without a scrim, high enough to read as intentional.
          opacity: 0.2 * entrance,
          transform: `translateY(${bob}px) scale(${parallax})`,
          transformOrigin: decor.corner === "left" ? "left bottom" : "right bottom",
        }}
      />
    </AbsoluteFill>
  );
};
