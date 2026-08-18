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
import { resolveCaptions, type CaptionSettings, type ResolvedTimeline, type VideoThemeTokens } from "@/lib/video/types";
import { activeWordIndex, wordTimingsFor } from "@/lib/video/captions";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans } from "../theme";

/**
 * The karaoke effect: the spoken word is brought forward, the rest of the line stays legible.
 *
 * Dimming rather than hiding the surrounding words is deliberate. Revealing them one at a time
 * reads well on a lyric video and badly on a teaching one — a learner needs to see the whole
 * clause to parse it, and words appearing one by one forces re-reading. So the line is complete
 * from the first frame and only the emphasis moves.
 *
 * Whitespace is preserved with a trailing space inside each span rather than a flex gap, so the
 * text wraps exactly as the unhighlighted version does at the same width.
 */
const WordHighlight: React.FC<{
  cue: ResolvedTimeline["cues"][number];
  t: number;
  theme: VideoThemeTokens;
}> = ({ cue, t, theme }) => {
  const words = wordTimingsFor({
    text: cue.text,
    durationSeconds: Math.max(0.001, cue.end - cue.start),
    lang: cue.lang,
    measured: cue.words,
  });
  const active = activeWordIndex(words, t - cue.start);
  if (words.length === 0) return <>{cue.text}</>;
  return (
    <>
      {words.map((w, i) => (
        <span
          key={`${i}-${w.text}`}
          style={{
            color: i === active ? theme.primary : "#fff",
            opacity: i <= active ? 1 : 0.62,
            // No transition property: Remotion seeks to a frame and screenshots it, so a CSS
            // transition would land mid-interpolation at an arbitrary point and differ between
            // the preview and the render.
            textShadow: i === active ? "0 2px 10px rgba(0,0,0,0.7)" : undefined,
          }}
        >
          {w.text}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
};

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
        {resolved.mode === "word" && cue.lang !== "ja" ? (
          <WordHighlight cue={cue} t={t} theme={theme} />
        ) : (
          cue.text
        )}
      </div>
    </div>
  );
};
