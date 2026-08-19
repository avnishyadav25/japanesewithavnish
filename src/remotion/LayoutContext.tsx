/**
 * Layout + theme context shared by every scene.
 *
 * One composition serves all four output formats. The storyboard carries no geometry at all —
 * scenes read the layout from here and pick a variant, so a vocabulary card stacks at 9:16 and
 * goes two-column at 16:9 without the storyboard knowing which is being rendered.
 */
import React, { createContext, useContext, useMemo } from "react";
import type { VideoStylePreset, VideoThemeTokens } from "@/lib/video/types";
import { motionFor, type MotionPreset } from "@/lib/video/motion";
import { DEFAULT_THEME, LAYOUT_SCALES, type LayoutScale, type SceneLayout } from "./theme";

interface LayoutContextValue {
  layout: SceneLayout;
  scale: LayoutScale;
  theme: VideoThemeTokens;
  /** How much everything moves. Scenes never branch on the preset name, only on these numbers. */
  motion: MotionPreset;
}

const LayoutContext = createContext<LayoutContextValue>({
  layout: "vertical",
  scale: LAYOUT_SCALES.vertical,
  theme: DEFAULT_THEME,
  motion: motionFor("lesson"),
});

export const LayoutProvider: React.FC<{
  layout: SceneLayout;
  theme: VideoThemeTokens;
  stylePreset?: VideoStylePreset | null;
  children: React.ReactNode;
}> = ({ layout, theme, stylePreset, children }) => {
  const value = useMemo(
    () => ({ layout, scale: LAYOUT_SCALES[layout], theme, motion: motionFor(stylePreset) }),
    [layout, theme, stylePreset]
  );
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}

/**
 * Per-scene facts the camera needs, supplied by VideoRoot because it is the only component that
 * knows them.
 *
 * `useVideoConfig().durationInFrames` inside a <Sequence> is not a reliable substitute — whether
 * it reports the sequence span or the whole composition has changed across Remotion versions, and
 * a camera that silently ramps over the wrong span would be invisible in review and wrong in the
 * render. VideoRoot already computes both values for the timeline, so it passes them down.
 */
interface SceneMotionValue {
  /** Frames, scene-relative, at which each narration segment begins. */
  beatFrames: number[];
  durationInFrames: number;
  /**
   * The scene's frozen sticker, carried here rather than passed as a prop.
   *
   * Every one of the twenty scene components renders through SceneFrame, so a prop would mean
   * editing all twenty to thread a value none of them use — and the next scene added would forget.
   * Context puts it in one place, and SceneFrame is the only reader.
   */
  decor?: { slug: string; url: string; corner: "left" | "right" };
}

const SceneMotionContext = createContext<SceneMotionValue>({ beatFrames: [], durationInFrames: 0 });

export const SceneMotionProvider: React.FC<{
  beatFrames: number[];
  durationInFrames: number;
  decor?: { slug: string; url: string; corner: "left" | "right" };
  children: React.ReactNode;
}> = ({ beatFrames, durationInFrames, decor, children }) => {
  const value = useMemo(() => ({ beatFrames, durationInFrames, decor }), [beatFrames, durationInFrames, decor]);
  return <SceneMotionContext.Provider value={value}>{children}</SceneMotionContext.Provider>;
};

export function useSceneMotion(): SceneMotionValue {
  return useContext(SceneMotionContext);
}
