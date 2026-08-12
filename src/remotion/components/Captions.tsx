/**
 * Burned-in captions.
 *
 * Required for Shorts/Reels/TikTok, where most viewing is muted — an unsubtitled short is
 * effectively a silent slideshow. Cues come from the resolved timeline (which derives them
 * from measured audio), never from re-splitting narration text here, so the caption on screen
 * is always the sentence currently being spoken.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import type { ResolvedTimeline } from "@/lib/video/types";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans } from "../theme";

export const Captions: React.FC<{ timeline: ResolvedTimeline; style: "bold-center" | "lower-third" }> = ({
  timeline,
  style,
}) => {
  const frame = useCurrentFrame();
  const { theme, scale, layout } = useLayout();
  const t = frame / timeline.fps;
  const cue = timeline.cues.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;

  const isJa = cue.lang === "ja";
  const bottom = layout === "vertical" ? scale.pad * 2.4 : scale.pad * 1.1;

  return (
    <div
      style={{
        position: "absolute",
        left: scale.pad * 0.7,
        right: scale.pad * 0.7,
        bottom,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: isJa ? fontStackJa(theme) : fontStackSans(theme),
          fontSize: style === "bold-center" ? scale.caption * 1.05 : scale.caption * 0.9,
          fontWeight: 700,
          lineHeight: 1.32,
          textAlign: "center",
          color: "#fff",
          background: "rgba(12,12,12,0.82)",
          padding: `${scale.gap * 0.34}px ${scale.gap * 0.62}px`,
          borderRadius: theme.radius * 0.7,
          maxWidth: "94%",
          // A hard shadow keeps text legible if the cue lands over bright B-roll.
          textShadow: "0 2px 6px rgba(0,0,0,0.55)",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};
