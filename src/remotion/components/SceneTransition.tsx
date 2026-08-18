/**
 * Applies `Scene.transitionIn`.
 *
 * WHY THIS DID NOT EXIST. `TransitionKind` has been in types.ts since the first version, and
 * `storyboard.ts` writes a `transitionIn` onto every scene it builds at thirteen separate call
 * sites — but nothing ever read the field. Every scene change in every rendered video has been a
 * hard cut, including the ones whose storyboard says `{ kind: "fade" }`. This closes that gap.
 *
 * IN-TRANSITIONS ONLY, no cross-fade. A real cross-fade needs the outgoing and incoming scenes on
 * screen together, which means overlapping spans — but VideoRoot places each scene in a
 * `<Sequence>` that clips its children to its own range, and the resolved timeline assigns each
 * scene a disjoint frame span that the .srt writer, the FCPXML exporter and the highlight
 * extractor all read. Overlapping them would mean rewriting the timeline contract for every
 * consumer, to buy a 0.18s dissolve. An in-transition gets most of the effect for none of that.
 *
 * `kenburns` is the exception to "in": it is a slow move across the WHOLE scene, so it reads
 * `durationInFrames` rather than the transition duration.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Transition } from "@/lib/video/types";

export const SceneTransition: React.FC<{
  transition?: Transition;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ transition, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const kind = transition?.kind ?? "none";
  if (kind === "none") return <>{children}</>;

  // A transition longer than the scene would never finish, leaving it permanently mid-wipe. Half
  // the scene is the ceiling; a beat in a Short can be shorter than the 0.3s a lesson fade wants.
  const frames = Math.max(
    1,
    Math.min(Math.round((transition?.durationSeconds ?? 0.3) * fps), Math.floor(durationInFrames / 2))
  );
  const t = interpolate(frame, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Ease-out cubic. A linear wipe reads as mechanical; the difference is small and entirely
  // one-sided.
  const eased = 1 - Math.pow(1 - t, 3);

  if (kind === "kenburns") {
    const p = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ transform: `scale(${1.04 + p * 0.08}) translateY(${-p * 1.2}%)` }}>
        {children}
      </AbsoluteFill>
    );
  }

  const style: React.CSSProperties =
    kind === "fade"
      ? { opacity: eased }
      : kind === "slide"
        ? { opacity: Math.min(1, eased * 1.6), transform: `translateX(${(1 - eased) * 7}%)` }
        : // wipe: reveal left-to-right. `inset` from the right edge rather than a width change so
          // the content never reflows mid-transition — a reflowing wipe re-wraps the Japanese and
          // reads as a glitch.
          { clipPath: `inset(0 ${(1 - eased) * 100}% 0 0)` };

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
