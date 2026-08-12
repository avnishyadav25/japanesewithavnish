/**
 * Remotion composition registry.
 *
 * Four compositions, one component. The storyboard carries no geometry, so producing a second
 * aspect ratio is a matter of different width/height/layout props — not a second set of scenes
 * to maintain in parallel.
 *
 * Duration comes from `calculateMetadata` rather than a fixed `durationInFrames`: the length of
 * a video is a property of its narration audio, which is only known after the TTS stage runs.
 */
import React from "react";
import { Composition } from "remotion";
import type { Storyboard, VideoThemeTokens } from "@/lib/video/types";
import { FORMAT_SPECS } from "@/lib/video/types";
import { buildTimeline } from "@/lib/video/timeline";
import { VideoRoot, type VideoRootProps } from "./VideoRoot";
import { SAMPLE_STORYBOARD } from "./sampleStoryboard";
import "./fonts";

type Props = {
  storyboard: Storyboard;
  themeTokens?: Partial<VideoThemeTokens> | null;
  bgmUrl?: string | null;
};

const FORMATS = [
  { id: "Video-Vertical", format: "vertical" as const },
  { id: "Video-Landscape", format: "landscape" as const },
  { id: "Video-Square", format: "square" as const },
  { id: "Video-Embed", format: "embed" as const },
];

export const RemotionRoot: React.FC = () => (
  <>
    {FORMATS.map(({ id, format }) => {
      const spec = FORMAT_SPECS[format];
      return (
        <Composition
          key={id}
          id={id}
          component={VideoRoot as unknown as React.FC<Record<string, unknown>>}
          width={spec.width}
          height={spec.height}
          fps={spec.fps}
          durationInFrames={300}
          defaultProps={
            {
              storyboard: SAMPLE_STORYBOARD,
              layout: spec.layout,
              themeTokens: null,
              bgmUrl: null,
            } as unknown as Record<string, unknown>
          }
          calculateMetadata={({ props }) => {
            const { storyboard } = props as unknown as Props;
            const timeline = storyboard?.resolved ?? buildTimeline(storyboard, { format });
            return {
              durationInFrames: Math.max(1, timeline.totalFrames),
              fps: spec.fps,
              width: spec.width,
              height: spec.height,
              props: { ...(props as object), layout: spec.layout } as Record<string, unknown>,
            };
          }}
        />
      );
    })}
  </>
);

export type { VideoRootProps };
