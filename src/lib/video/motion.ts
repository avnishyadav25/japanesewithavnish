/**
 * Video Studio — how much the picture moves.
 *
 * WHY THIS FILE EXISTS. Before it, every entrance in the app went through one hardcoded spring in
 * primitives.tsx: `spring({ damping: 200, mass: 0.6 })`. A damping of 200 against a mass of 0.6 is
 * heavily overdamped — the value glides to its target and never overshoots. That single constant
 * *is* the calm, classroom feeling of the videos, applied identically to a five-minute grammar
 * lesson and to a thirty-second Reel.
 *
 * Measured, on a 16-second vocabulary scene: `VocabCardScene` fires one PopIn and four FadeUps at
 * frames 8/14/20/26, so all motion is complete by frame 40 — 1.3 seconds — and the remaining ~14.7
 * seconds are a still image. That is the whole problem this module addresses.
 *
 * Isomorphic and dependency-free on purpose: the storyboard builder reads it on the server to size
 * scenes, and Remotion components read it in the browser to animate them. Importing anything with
 * a Node dependency here would break the render bundle (learned the hard way — blankScene.ts once
 * pulled `fs` into the client through a single type import, and tsc and lint both passed).
 */
import type { VideoStylePreset } from "./types";

export interface SpringConfig {
  damping: number;
  mass: number;
  stiffness?: number;
}

export interface MotionPreset {
  /** Entrance spring for FadeUp — blocks of supporting content. */
  enter: SpringConfig;
  /** Distance in px a FadeUp travels. Shorter feels snappier at the same duration. */
  enterDistance: number;
  /** Scale-in spring for PopIn — the one hero element of a scene. */
  hero: SpringConfig;
  /** Scale a PopIn starts from. Further from 1 reads as more forceful. */
  heroFrom: number;
  /**
   * Frames between staggered children. The scene files pass literal delays (8, 14, 20, 26) which
   * are multiplied by this, so tightening the whole app's stagger is one number rather than an
   * edit to every scene.
   */
  staggerScale: number;
  /**
   * Continuous camera push across a scene, as a scale delta. 0 disables the camera entirely.
   *
   * This is what stops a frame being static once its entrances finish. Small on purpose: at 0.05
   * over a three-second beat the movement is below conscious notice and still reads as alive.
   */
  cameraPush: number;
  /** Extra scale snapped on at each narration-segment boundary, decaying over ~0.4s. */
  cameraPunch: number;
  /** Default transition between scenes when the storyboard does not say. */
  transition: { kind: "none" | "fade" | "slide" | "wipe" | "kenburns"; durationSeconds: number };
}

/**
 * `lesson` reproduces the previous hardcoded values EXACTLY — damping 200 / mass 0.6 for FadeUp,
 * damping 14 / mass 0.5 / stiffness 120 for PopIn, distance 28, scale 0.82, stagger 1.0. That is
 * deliberate and load-bearing: introducing a preset must not change a single existing frame, so
 * any drift in these numbers is a bug, not a taste decision. `cameraPush: 0` keeps lesson scenes
 * as still as they have always been.
 */
export const MOTION_PRESETS: Record<VideoStylePreset, MotionPreset> = {
  lesson: {
    enter: { damping: 200, mass: 0.6 },
    enterDistance: 28,
    hero: { damping: 14, mass: 0.5, stiffness: 120 },
    heroFrom: 0.82,
    staggerScale: 1,
    cameraPush: 0,
    cameraPunch: 0,
    transition: { kind: "fade", durationSeconds: 0.3 },
  },
  shorts: {
    // damping 18 against stiffness 190 settles in ~0.35s with a slight overshoot: the value
    // arrives, tips fractionally past, and comes back. That overshoot is most of what separates
    // "modern" from "corporate" — the old damping of 200 mathematically cannot produce it.
    enter: { damping: 18, mass: 0.5, stiffness: 190 },
    enterDistance: 44,
    hero: { damping: 11, mass: 0.4, stiffness: 200 },
    heroFrom: 0.6,
    // Halved: a beat is ~2.5s rather than ~16s, so the same frame delays would still be staggering
    // in when the beat is already ending.
    staggerScale: 0.5,
    cameraPush: 0.05,
    cameraPunch: 0.018,
    transition: { kind: "slide", durationSeconds: 0.18 },
  },
};

export function motionFor(preset: VideoStylePreset | undefined | null): MotionPreset {
  return MOTION_PRESETS[preset ?? "lesson"] ?? MOTION_PRESETS.lesson;
}

/**
 * Where the camera is at `frame`, given the beat boundaries within a scene.
 *
 * Two components summed:
 *   push  — a linear ramp across the whole scene, so the frame is never truly still.
 *   punch — a decaying step at each beat start, so a boundary reads as a cut even when the scene
 *           behind it continues.
 *
 * `beatFrames` are the narration-segment offsets the timeline already computes, so this needs no
 * new data and stays in sync with the audio for free.
 */
export function cameraScaleAt(
  frame: number,
  durationInFrames: number,
  beatFrames: readonly number[],
  motion: MotionPreset,
  fps: number
): number {
  if (motion.cameraPush === 0 && motion.cameraPunch === 0) return 1;

  const span = Math.max(1, durationInFrames);
  const push = motion.cameraPush * Math.min(1, Math.max(0, frame / span));

  let punch = 0;
  if (motion.cameraPunch > 0) {
    const decay = Math.max(1, fps * 0.4);
    // Only the most recent boundary matters — earlier ones have decayed to nothing, and summing
    // them would make the camera creep outward over a scene with many segments.
    let latest = -1;
    for (const b of beatFrames) if (b <= frame && b > latest) latest = b;
    if (latest >= 0) {
      const age = frame - latest;
      if (age < decay) punch = motion.cameraPunch * (1 - age / decay);
    }
  }

  return 1 + push + punch;
}
