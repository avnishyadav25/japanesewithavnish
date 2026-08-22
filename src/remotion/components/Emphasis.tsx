/**
 * Drawing attention to the thing being explained, at the moment it is explained.
 *
 * WHAT WAS MISSING. Nothing in the codebase pointed at, circled, spotlit or pulsed anything —
 * a grep for `arrow|pulse|spotlight` across src/remotion returned only `pointerEvents: "none"`.
 * The one existing highlight, `HighlightedJa`, is on from frame 0 and never moves, so it marks a
 * word rather than drawing the eye to it.
 *
 * THE RULE THIS FOLLOWS, from the roadmap: *"avoid adding animation merely for decoration; tie it
 * to the concept being taught."* So emphasis is not a style — it is a WINDOW IN TIME, opened by a
 * narration segment. `useSegmentWindow` turns a segment id into the frames during which that
 * sentence is being spoken, and emphasis lives only inside that window. If the narration never
 * mentions the thing, nothing lights up.
 *
 * Everything is frame-derived, never CSS-animated: Remotion renders by seeking to a frame and
 * screenshotting, so a CSS transition lands at an arbitrary point and the render disagrees with
 * the preview.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout, useSceneMotion } from "../LayoutContext";

export type EmphasisKind = "spotlight" | "pulse" | "point";

/**
 * The frame range during which a given narration segment is spoken.
 *
 * Derived from the beat frames the scene already publishes for the camera, so this needs no new
 * data and cannot drift from the audio. Returns null when the index is out of range, which is the
 * honest answer for a scene whose narration was regenerated shorter.
 */
export function useSegmentWindow(segmentIndex: number): { from: number; to: number } | null {
  const { beatFrames, durationInFrames } = useSceneMotion();
  if (segmentIndex < 0 || segmentIndex >= beatFrames.length) return null;
  const from = beatFrames[segmentIndex];
  const to = segmentIndex + 1 < beatFrames.length ? beatFrames[segmentIndex + 1] : durationInFrames;
  return { from, to };
}

/** 0 outside the window, ramping to 1 just inside it and back out — so nothing snaps on. */
function windowStrength(frame: number, from: number, to: number, fps: number): number {
  if (frame < from || frame > to) return 0;
  const ramp = Math.max(1, Math.round(fps * 0.28));
  const inLevel = interpolate(frame, [from, from + ramp], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outLevel = interpolate(frame, [to - ramp, to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.min(inLevel, outLevel);
}

/**
 * Wraps the element being taught.
 *
 * `spotlight` lifts and warms it (the dimming of everything else is done by SpotlightScrim, which
 * sits behind the content layer — a wrapper cannot dim its own siblings without knowing them).
 * `pulse` breathes it, for a thing already on screen that is being referred back to.
 * `point` puts a triangle beside it, for "this part here".
 */
export const Emphasis: React.FC<{
  kind: EmphasisKind;
  /** Which narration segment this belongs to. Emphasis is on only while it is being spoken. */
  segmentIndex: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ kind, segmentIndex, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, motion } = useLayout();
  const win = useSegmentWindow(segmentIndex);

  // A profile with no camera is a profile that wants stillness; emphasis would fight it.
  const enabled = motion.cameraPush > 0 && win !== null;
  const strength = enabled && win ? windowStrength(frame, win.from, win.to, fps) : 0;

  if (strength <= 0) return <div style={style}>{children}</div>;

  // A slow breath rather than a blink: two cycles over a typical sentence.
  const breath = kind === "pulse" ? (Math.sin((frame / fps) * 3.4) + 1) / 2 : 1;

  const scale = kind === "spotlight" ? 1 + 0.035 * strength : kind === "pulse" ? 1 + 0.018 * strength * breath : 1;

  return (
    <div
      style={{
        position: "relative",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "center center",
        // Warm glow rather than a border: a border changes the element's footprint and makes the
        // layout jump on the frame emphasis begins.
        filter:
          kind === "spotlight"
            ? `drop-shadow(0 0 ${18 * strength}px ${theme.primary}55)`
            : undefined,
        ...style,
      }}
    >
      {children}
      {kind === "point" && <Pointer strength={strength} />}
    </div>
  );
};

/** A triangle to the left of the emphasised element, nudging toward it. */
const Pointer: React.FC<{ strength: number }> = ({ strength }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, scale } = useLayout();
  const nudge = Math.sin((frame / fps) * 5.2) * 3 * strength;
  const size = scale.body * 0.55;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: -size * 2.1 + nudge,
        top: "50%",
        marginTop: -size / 2,
        width: 0,
        height: 0,
        opacity: strength,
        borderTop: `${size / 2}px solid transparent`,
        borderBottom: `${size / 2}px solid transparent`,
        borderLeft: `${size}px solid ${theme.primary}`,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Dims the whole frame so a spotlit element stands out.
 *
 * Separate from `Emphasis` because dimming is the inverse operation — it has to cover everything
 * the wrapper is NOT, which a child component cannot reach. Mounted by SceneFrame beneath the
 * content, so the spotlit element (which sits above) keeps its full brightness.
 */
export const SpotlightScrim: React.FC<{ segmentIndex: number }> = ({ segmentIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { motion } = useLayout();
  const win = useSegmentWindow(segmentIndex);
  if (motion.cameraPush <= 0 || !win) return null;

  const strength = windowStrength(frame, win.from, win.to, fps);
  if (strength <= 0) return null;

  // Deliberately shallow. At 0.22 the surrounding content is still readable — a learner glancing
  // at the example sentence while the word is spotlit should not have to wait for it to come back.
  return <AbsoluteFill style={{ background: `rgba(0,0,0,${0.22 * strength})`, pointerEvents: "none" }} />;
};
