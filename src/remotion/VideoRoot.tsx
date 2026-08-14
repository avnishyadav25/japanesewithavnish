/**
 * The composition body: one <Sequence> per scene, narration audio placed at its measured
 * offset, optional BGM underneath, captions on top.
 *
 * Timing is read from `storyboard.resolved`, never recomputed here. The worker's timeline
 * stage owns the seconds-to-frames conversion so the admin's <Player> preview and the headless
 * render agree frame for frame — if this component derived its own spans from audio durations,
 * a rounding difference would desync the preview from the output.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import type { ResolvedTimeline, Storyboard, VideoThemeTokens } from "@/lib/video/types";
import { buildTimeline, segmentOffsets } from "@/lib/video/timeline";
import { resolveBranding, showsHashtag } from "@/lib/video/branding";
import { LayoutProvider } from "./LayoutContext";
import { resolveTheme, type SceneLayout } from "./theme";
import { SceneRenderer } from "./scenes";
import { BrandOverlay } from "./components/BrandOverlay";
import { Captions } from "./components/Captions";

export interface VideoRootProps {
  storyboard: Storyboard;
  layout: SceneLayout;
  themeTokens?: Partial<VideoThemeTokens> | null;
  bgmUrl?: string | null;
  /**
   * Scrubbing the admin Player restarts the music on every seek, which is unpleasant, so the
   * preview mutes BGM by default and the editor offers a toggle to hear it. Renders always
   * include it.
   */
  preview?: boolean;
  /** Play BGM even in preview, for checking the mix. */
  previewBgm?: boolean;
}

/**
 * Per-frame gain for the music under speech.
 *
 * This IS the ducking, not an approximation of it — Remotion evaluates `volume` per frame and
 * bakes the result into the rendered audio, so the preview and the output apply exactly the
 * same curve. It reads from the resolved caption cues, which are themselves derived from
 * measured narration length, so the music drops on the syllable the voice starts rather than on
 * an amplitude threshold the way an ffmpeg sidechain compressor would.
 */
function bgmVolumeAt(timeline: ResolvedTimeline, frame: number, baseGain: number, duckDb: number): number {
  const t = frame / timeline.fps;
  const speaking = timeline.cues.some((c) => t >= c.start - 0.15 && t < c.end + 0.35);
  const db = speaking ? baseGain + duckDb : baseGain;
  return Math.min(1, Math.max(0, Math.pow(10, db / 20)));
}

export const VideoRoot: React.FC<VideoRootProps> = ({
  storyboard,
  layout,
  themeTokens,
  bgmUrl,
  preview,
  previewBgm,
}) => {
  const { fps } = useVideoConfig();
  const theme = resolveTheme(themeTokens);

  const format = layout === "vertical" ? "vertical" : layout === "square" ? "square" : "landscape";

  // A storyboard opened in the editor before the worker has run has no resolved timeline yet.
  // Build a provisional one so the preview still plays instead of rendering nothing.
  const timeline: ResolvedTimeline = storyboard.resolved ?? buildTimeline(storyboard, { format });

  const branding = resolveBranding(storyboard.branding);

  return (
    <LayoutProvider layout={layout} theme={theme}>
      <AbsoluteFill style={{ background: theme.bg }}>
        {storyboard.scenes.map((scene, i) => {
          const span = timeline.sceneFrameSpans[i];
          if (!span) return null;
          const [start, end] = span;
          const offsets = segmentOffsets(scene);

          return (
            <Sequence key={scene.id} from={start} durationInFrames={Math.max(1, end - start)} name={`${i + 1}. ${scene.sceneType}`}>
              <SceneRenderer scene={scene} />
              {scene.narration.map((segment, si) =>
                segment.audio?.url ? (
                  <Sequence key={segment.id} from={Math.round(offsets[si] * fps)} name={`audio:${segment.id}`}>
                    <Audio src={segment.audio.url} />
                  </Sequence>
                ) : null
              )}
            </Sequence>
          );
        })}

        {/* Above every scene, below the captions: a caption is the one thing that must never be
            obscured, and the watermark is the one thing that must never be cropped out. */}
        <BrandOverlay
          branding={branding}
          showHashtag={showsHashtag(format, branding)}
          scenes={storyboard.scenes}
          timeline={timeline}
        />

        {(!preview || previewBgm) && bgmUrl && storyboard.bgm ? (
          <Audio
            src={bgmUrl}
            loop
            volume={(frame) => bgmVolumeAt(timeline, frame, storyboard.bgm!.gainDb, storyboard.bgm!.duckDb)}
          />
        ) : null}

        {storyboard.captions.enabled && storyboard.captions.burnIn ? (
          <Captions timeline={timeline} style={storyboard.captions.style} />
        ) : null}
      </AbsoluteFill>
    </LayoutProvider>
  );
};
