"use client";

/**
 * Brand check — every branded frame, in every format, on one page.
 *
 * WHY THIS EXISTS RATHER THAN `scripts/video-brand-preview.ts`
 * That script goes through `@remotion/bundler`, which stalls at 6% on at least one dev machine
 * and takes the filesystem down with it (see the memory note). This page reaches the SAME
 * VideoRoot tree through `@remotion/player`, which runs inside Next's own webpack — so it needs
 * nothing but `npm run dev`, and what it shows is what renders.
 *
 * It exists because branding is the one part of the pipeline with no meaningful automated
 * assertion. A logo that fails to load, a hashtag that vanishes against red, an icon row clipped
 * off a 9:16 frame — all typecheck, lint and render without error. The first pass through this
 * page caught `localhost:3000` printed into the outro's URL pill.
 *
 * Frames are picked 75% into each scene rather than as a percentage of the video: an earlier
 * version landed one frame into a scene, where every entrance spring is still at zero, and the
 * corner mascot looked missing when it was merely mid-animation.
 */
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { VideoRoot } from "@/remotion/VideoRoot";
import { SAMPLE_STORYBOARD } from "@/remotion/sampleStoryboard";
import { buildTimeline } from "@/lib/video/timeline";
import { FORMAT_SPECS, type VideoFormat, type VideoStylePreset } from "@/lib/video/types";
import { BrandAssets } from "./BrandAssets";

const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), { ssr: false });

function Frame({
  label,
  format,
  at,
  preset = "lesson",
}: {
  label: string;
  format: VideoFormat;
  at: "mid" | "outro" | "intro";
  /** Which motion register to render in. Both are shown so the difference is visible side by
   *  side rather than described — the whole point of the Shorts preset is a feel, and a feel
   *  cannot be asserted in a test. */
  preset?: VideoStylePreset;
}) {
  const spec = FORMAT_SPECS[format];
  const layout = spec.layout;
  const storyboard = useMemo(
    () => ({ ...SAMPLE_STORYBOARD, stylePreset: preset, captions: { ...SAMPLE_STORYBOARD.captions, mode: preset === "shorts" ? ("word" as const) : ("line" as const) } }),
    [preset]
  );
  const timeline = buildTimeline(storyboard, { format });
  const total = timeline.totalFrames;
  const spans = timeline.sceneFrameSpans;
  // Land WELL INSIDE a scene. Picking a percentage of the whole video put the first shot one
  // frame into its scene, where every entrance spring is still at zero — the corner mascot was
  // rendering correctly and was simply invisible.
  const pick = (i: number) => {
    const [s0, e0] = spans[Math.min(i, spans.length - 1)] ?? [0, total];
    return Math.min(e0 - 2, s0 + Math.round((e0 - s0) * 0.75));
  };
  const frame = at === "intro" ? pick(0) : at === "outro" ? pick(spans.length - 1) : pick(2);

  return (
    <div style={{ margin: 12 }}>
      <div style={{ font: "600 12px system-ui", marginBottom: 6 }}>
        {label} · frame {frame}/{total}
      </div>
      <div style={{ width: format === "landscape" ? 480 : 270 }} data-testid={`shot-${label}`}>
        <Player
          component={VideoRoot as never}
          inputProps={{ storyboard, layout, themeTokens: null, preview: true }}
          durationInFrames={total}
          fps={spec.fps}
          compositionWidth={spec.width}
          compositionHeight={spec.height}
          initialFrame={frame}
          style={{ width: "100%" }}
          controls={false}
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  );
}

export default function BrandCheckPage() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="font-heading text-2xl font-bold text-charcoal">Brand check</h1>
        <p className="text-sm text-secondary mt-1">
          What is available to put in a video, and what a video made from it looks like.
        </p>
      </div>

      <BrandAssets />

      <div style={{ marginBottom: 12 }}>
        <h2 className="font-heading text-lg font-bold text-charcoal">Rendered frames</h2>
        <p className="text-sm text-secondary mt-1">
          The same composition the worker renders, seeked to the frames most likely to be wrong.
          Vertical and square carry the hashtag and the small top-centre title; landscape
          deliberately carries neither. The title bar is suppressed on the title card, the mascot
          intro and the outro, which already say it.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", background: "#222", padding: 12, borderRadius: 12 }}>
        <Frame label="vertical-intro" format="vertical" at="intro" />
        <Frame label="vertical-mid" format="vertical" at="mid" />
        <Frame label="vertical-outro" format="vertical" at="outro" />
        <Frame label="landscape-mid" format="landscape" at="mid" />
        {/* square-mid earns its place: the title bar shows on vertical and square MID scenes only
            — intro, outro and landscape all suppress it — so without this shot four of five frames
            could not show the feature at all. */}
        <Frame label="square-mid" format="square" at="mid" />
        <Frame label="square-outro" format="square" at="outro" />

        {/* The Shorts register. Same storyboard, same scene, different preset — so any difference
            you see here is the preset and nothing else. Seek the player: lesson motion completes
            in the first 1.3s and then holds; shorts keeps moving for the whole beat. */}
        <Frame label="shorts-vertical-mid" format="vertical" at="mid" preset="shorts" />
        <Frame label="shorts-vertical-intro" format="vertical" at="intro" preset="shorts" />
        <Frame label="shorts-square-mid" format="square" at="mid" preset="shorts" />
      </div>
    </div>
  );
}
