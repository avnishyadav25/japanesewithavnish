/**
 * Shared presentational primitives for scenes.
 *
 * Every animation here is driven by `useCurrentFrame()` rather than CSS transitions or
 * keyframes. Remotion renders by seeking Chrome to a frame and screenshotting it; a CSS
 * animation is wall-clock driven and would land on a different position each run, producing
 * renders that differ from the admin's <Player> preview and from each other.
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout, useSceneMotion } from "../LayoutContext";
import { cameraScaleAt } from "@/lib/video/motion";
import { nearestJaWeight } from "../fonts";
import { fontStackJa, fontStackSans } from "../theme";

/**
 * Fade + rise, the default entrance for any block of content.
 *
 * `distance` is a per-call override; left unset it comes from the motion preset, so tuning how far
 * everything travels is one constant rather than an edit to every caller. `delay` is scaled by the
 * preset's stagger: scene files pass literal frame numbers (8, 14, 20, 26) chosen for a 16-second
 * lesson scene, and those same numbers would still be arriving as a 2.5-second Shorts beat ends.
 */
export const FadeUp: React.FC<{
  delay?: number;
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, distance, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { motion } = useLayout();
  const travel = distance ?? motion.enterDistance;
  const progress = spring({ frame: frame - delay * motion.staggerScale, fps, config: motion.enter });
  return (
    <div
      style={{
        // Clamped because an overshooting spring returns values above 1, and an opacity of 1.04
        // is a console warning in Chrome on every frame of a 30-second render.
        opacity: Math.min(1, Math.max(0, progress)),
        transform: `translateY(${interpolate(progress, [0, 1], [travel, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Scale-in for the single hero element of a scene (the word, the kanji, the pattern). */
export const PopIn: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { motion } = useLayout();
  const progress = spring({ frame: frame - delay * motion.staggerScale, fps, config: motion.hero });
  return (
    <div
      style={{
        opacity: interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${interpolate(progress, [0, 1], [motion.heroFrom, 1])})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Japanese text with an optional furigana reading rendered above it.
 * Uses <ruby> so the reading tracks the base text's width instead of being absolutely
 * positioned, which keeps it centred for both 1-character and 8-character words. */
export const JapaneseText: React.FC<{
  text: string;
  reading?: string;
  size: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ text, reading, size, color, weight = 700, style }) => {
  const { theme } = useLayout();
  const showReading = Boolean(reading && reading !== text);
  // Only 400 and 700 are actually loaded for Japanese (see ./fonts.ts). Asking for 600 or 800
  // makes the browser synthesize a fake weight by smearing the outline, which is barely
  // noticeable on Latin text and obviously wrong on a dense kanji.
  const jaWeight = nearestJaWeight(weight);
  return (
    <div
      style={{
        fontFamily: fontStackJa(theme),
        fontSize: size,
        fontWeight: jaWeight,
        color: color ?? theme.text,
        lineHeight: 1.25,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {showReading ? (
        <ruby style={{ rubyPosition: "over" }}>
          {text}
          <rt style={{ fontSize: size * 0.32, fontWeight: 500, color: theme.textMuted, letterSpacing: "0.02em" }}>
            {reading}
          </rt>
        </ruby>
      ) : (
        text
      )}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, scale } = useLayout();
  return (
    <div
      style={{
        fontFamily: fontStackSans(theme),
        fontSize: scale.caption * 0.78,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: theme.primary,
      }}
    >
      {children}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; tone?: "accent" | "muted" }> = ({
  children,
  tone = "muted",
}) => {
  const { theme, scale } = useLayout();
  const accent = tone === "accent";
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: fontStackSans(theme),
        fontSize: scale.caption * 0.8,
        fontWeight: 600,
        padding: `${scale.caption * 0.28}px ${scale.caption * 0.66}px`,
        borderRadius: 999,
        color: accent ? "#fff" : theme.textMuted,
        background: accent ? theme.primary : theme.border,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
};

/** The card surface most scenes sit on. */
export const Surface: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { theme, scale } = useLayout();
  return (
    <div
      style={{
        background: theme.surface,
        borderRadius: theme.radius * 1.6,
        border: `2px solid ${theme.border}`,
        padding: scale.gap * 1.3,
        boxShadow: "0 18px 60px rgba(0,0,0,0.07)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Common scene chrome: background, centred column, consistent padding — and the camera.
 *
 * THE CAMERA IS THE POINT. Every scene in the app renders through this component, so a move
 * applied here reaches all twenty of them without touching one. Measured before it existed: a
 * 16-second vocabulary scene completed every entrance by frame 40 and then held a literally
 * identical frame for 14.7 seconds, which is what made the videos feel like a slide deck.
 *
 * It is applied to the content layer only, never to the background — scaling the background would
 * expose the frame edge on a solid colour and crop a B-roll still. Lesson renders pass
 * `cameraPush: 0` and `cameraPunch: 0`, so `cameraScaleAt` returns exactly 1 and the transform is
 * an identity: existing videos are unchanged frame for frame.
 */
export const SceneFrame: React.FC<{
  children: React.ReactNode;
  justify?: React.CSSProperties["justifyContent"];
  background?: string;
}> = ({ children, justify = "center", background }) => {
  const { theme, scale, motion } = useLayout();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { beatFrames, durationInFrames } = useSceneMotion();
  const camera = cameraScaleAt(frame, durationInFrames, beatFrames, motion, fps);
  return (
    <AbsoluteFill style={{ background: background ?? theme.bg }}>
      <AbsoluteFill
        style={{
          transform: camera === 1 ? undefined : `scale(${camera})`,
          transformOrigin: "center center",
          padding: scale.pad,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: justify,
          gap: scale.gap,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: scale.maxContentWidth,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: scale.gap,
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** "3 / 10" plus a fill bar. Only meaningful for multi-item scenes. */
export const StepIndicator: React.FC<{ index: number; total: number }> = ({ index, total }) => {
  const { theme, scale } = useLayout();
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: scale.gap * 0.35 }}>
      <div
        style={{
          fontFamily: fontStackSans(theme),
          fontSize: scale.caption * 0.85,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: theme.textSubtle,
        }}
      >
        {index} / {total}
      </div>
      <div style={{ height: 8, width: "100%", background: theme.border, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(index / total) * 100}%`, background: theme.primary, borderRadius: 999 }} />
      </div>
    </div>
  );
};
