/**
 * Burned-in captions.
 *
 * Required for Shorts/Reels/TikTok, where most viewing is muted — an unsubtitled short is
 * effectively a silent slideshow. Cues come from the resolved timeline (which derives them
 * from measured audio), never from re-splitting narration text here, so the caption on screen
 * is always the sentence currently being spoken.
 *
 * SIZING IS A SETTING NOW, NOT A CONSTANT. It used to render at `scale.caption * 1.05` across
 * 94% of the width — 42px in a 1080x1920 frame — which on a vocabulary scene covered the example
 * sentence being read out. `settings` comes from video_projects.captions at render time, so
 * changing it is a re-cut rather than a regenerate.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { resolveCaptions, type CaptionSettings, type ResolvedTimeline } from "@/lib/video/types";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans } from "../theme";

export const Captions: React.FC<{
  timeline: ResolvedTimeline;
  style: "bold-center" | "lower-third";
  settings?: Partial<CaptionSettings> | null;
}> = ({ timeline, style, settings }) => {
  const frame = useCurrentFrame();
  const { theme, scale, layout } = useLayout();
  const t = frame / timeline.fps;
  const cue = timeline.cues.find((c) => t >= c.start && t < c.end);

  const resolved = resolveCaptions(settings);
  if (!cue || !resolved.enabled || !resolved.burnIn) return null;

  const isJa = cue.lang === "ja";
  const base = style === "bold-center" ? scale.caption * 1.05 : scale.caption * 0.9;
  const fontSize = base * resolved.scale;

  // `bottom` clears the hashtag pill on vertical; `top` clears the logo watermark, which sits
  // top-RIGHT, so a centred caption at the top does not collide with it.
  const placement =
    resolved.position === "top"
      ? { top: scale.pad * 1.6, alignItems: "flex-start" as const }
      : resolved.position === "lower-third"
        ? { bottom: layout === "vertical" ? scale.pad * 5.2 : scale.pad * 2.6, alignItems: "flex-end" as const }
        : { bottom: layout === "vertical" ? scale.pad * 2.4 : scale.pad * 1.1, alignItems: "flex-end" as const };

  return (
    <div
      style={{
        position: "absolute",
        left: scale.pad * 0.7,
        right: scale.pad * 0.7,
        ...placement,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: isJa ? fontStackJa(theme) : fontStackSans(theme),
          fontSize,
          fontWeight: 700,
          lineHeight: 1.32,
          textAlign: "center",
          color: "#fff",
          background: `rgba(12,12,12,${resolved.opacity})`,
          // Padding tracks the font size rather than the layout constant, so a smaller caption
          // gets a proportionally smaller plate instead of a small word in a large box.
          padding: `${fontSize * 0.28}px ${fontSize * 0.52}px`,
          borderRadius: theme.radius * 0.7,
          maxWidth: `${resolved.maxWidthPct}%`,
          // A hard shadow keeps text legible if the cue lands over bright B-roll, and is the only
          // thing holding the text up when opacity is turned down to 0.
          textShadow: "0 2px 6px rgba(0,0,0,0.55)",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};
