"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { buildTimeline } from "@/lib/video/timeline";
import { FORMAT_SPECS, type Storyboard, type VideoFormat, type VideoThemeTokens } from "@/lib/video/types";
import { VideoRoot } from "@/remotion/VideoRoot";

/**
 * Remotion's <Player> renders the exact same composition the worker renders, so this preview
 * is the real thing rather than an approximation — if it looks right here it renders right.
 *
 * Dynamically imported with ssr:false for two reasons: the Player touches `window` during
 * module init, and it pulls in a few hundred KB that no other admin page should have to
 * download.
 */
const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
  loading: () => (
    <div className="aspect-[9/16] max-h-[520px] w-full bg-base rounded-card flex items-center justify-center text-sm text-secondary">
      Loading preview…
    </div>
  ),
});

/** The slice of Remotion's PlayerRef the timeline needs. Typed structurally rather than
 * importing PlayerRef, so @remotion/player stays out of the server-rendered module graph. */
export interface PlayerHandle {
  seekTo: (frame: number) => void;
  getCurrentFrame: () => number;
  play: () => void;
  pause: () => void;
}

interface Props {
  storyboard: Storyboard;
  format: VideoFormat;
  themeTokens: Partial<VideoThemeTokens> | null;
  playerRef?: React.MutableRefObject<PlayerHandle | null>;
}

export function StoryboardPlayer({ storyboard, format, themeTokens, playerRef }: Props) {
  const spec = FORMAT_SPECS[format];

  // A storyboard that has never been rendered has no resolved timeline (durations come from
  // measured narration audio, which only exists after a render). Fall back to the same
  // provisional timeline VideoRoot would compute, so the preview is playable immediately
  // after generation instead of showing nothing until the first render finishes.
  const durationInFrames = useMemo(() => {
    const timeline = storyboard.resolved ?? buildTimeline(storyboard, { format });
    return Math.max(1, timeline.totalFrames);
  }, [storyboard, format]);

  const inputProps = useMemo(
    () => ({ storyboard, layout: spec.layout, themeTokens, bgmUrl: null, preview: true }),
    [storyboard, spec.layout, themeTokens]
  );

  return (
    <Player
      ref={playerRef as never}
      component={VideoRoot as never}
      inputProps={inputProps as never}
      durationInFrames={durationInFrames}
      fps={spec.fps}
      compositionWidth={spec.width}
      compositionHeight={spec.height}
      controls
      loop
      acknowledgeRemotionLicense
      style={{ width: "100%", borderRadius: 16, overflow: "hidden", background: "#000" }}
    />
  );
}
