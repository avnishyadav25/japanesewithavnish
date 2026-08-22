import React from "react";
import { Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type {
  BrollPageVisual,
  DialogueVisual,
  ListeningPromptVisual,
  QuizQuestionVisual,
  ReadingPassageVisual,
} from "@/lib/video/types";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans, fontStackSerif } from "../theme";
import { Chip, Eyebrow, FadeUp, JapaneseText, SceneFrame, Surface } from "../components/primitives";

/**
 * Real-page B-roll: a screenshot or short clip of the live site.
 *
 * A 1920-wide desktop capture dropped into a 1080x1920 frame would letterbox to a stripe, so
 * stills are cropped to fill and slowly panned (Ken Burns) instead — the motion also stops a
 * static screenshot from reading as a frozen video.
 */
export const BrollPageScene: React.FC<{ visual: BrollPageVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  const { durationInFrames, height: frameHeight, width: frameWidth } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  // A scroll_clip is captured as one tall full-page screenshot; panning it here is what turns
  // it back into a scroll. Anything taller than ~1.25 frames is worth panning rather than
  // squashing — below that there is nothing to reveal and a slow zoom reads better.
  const asset = visual.asset;
  const aspect = asset?.width && asset?.height ? asset.height / asset.width : null;
  const frameAspect = frameHeight / frameWidth;
  const isTall = aspect !== null && aspect > frameAspect * 1.25;

  const zoom = interpolate(progress, [0, 1], [1.06, 1.16]);
  const drift = interpolate(progress, [0, 1], [0, -3]);

  if (!visual.asset?.url) {
    // Capture failed or hasn't run — a labelled placeholder beats a black frame, and it makes
    // the failure obvious in the preview rather than at publish time.
    return (
      <SceneFrame>
        <Surface style={{ width: "100%", textAlign: "center", borderStyle: "dashed" }}>
          <Eyebrow>B-roll pending</Eyebrow>
          <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption, color: theme.textMuted, marginTop: scale.gap * 0.4 }}>
            {visual.sourceUrl}
          </div>
        </Surface>
      </SceneFrame>
    );
  }

  return (
    <SceneFrame background="#000">
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {visual.asset.kind === "video" ? (
          <OffthreadVideo
            src={visual.asset.url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        ) : isTall ? (
          // Full width, natural height, translated upward so the whole page scrolls past.
          // A 20% tail is left unscrolled so the pan does not stop dead on the last pixel.
          <Img
            src={visual.asset.url}
            style={{
              width: "100%",
              height: "auto",
              position: "absolute",
              top: 0,
              transform: `translateY(${-progress * 0.8 * Math.max(0, (aspect ?? 0) * frameWidth - frameHeight)}px)`,
            }}
          />
        ) : (
          <Img
            src={visual.asset.url}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom}) translateY(${drift}%)`,
            }}
          />
        )}
      </div>
      {visual.caption ? (
        <div style={{ position: "absolute", left: scale.pad, right: scale.pad, bottom: scale.pad * 1.4 }}>
          <FadeUp>
            <div
              style={{
                fontFamily: fontStackSans(theme),
                fontSize: scale.body * 0.9,
                fontWeight: 700,
                color: "#fff",
                background: "rgba(0,0,0,0.6)",
                padding: `${scale.gap * 0.4}px ${scale.gap * 0.7}px`,
                borderRadius: theme.radius,
                display: "inline-block",
              }}
            >
              {visual.caption}
            </div>
          </FadeUp>
        </div>
      ) : null}
    </SceneFrame>
  );
};

export const DialogueScene: React.FC<{ visual: DialogueVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  return (
    <SceneFrame>
      {visual.title ? (
        <FadeUp>
          <Eyebrow>{visual.title}</Eyebrow>
        </FadeUp>
      ) : null}
      <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.5 }}>
        {visual.lines.slice(0, 6).map((line, i) => {
          const isLeft = i % 2 === 0;
          return (
            <FadeUp key={i} delay={6 + i * 12} distance={20}>
              <div style={{ display: "flex", justifyContent: isLeft ? "flex-start" : "flex-end" }}>
                <div style={{ maxWidth: "86%", display: "grid", gap: scale.gap * 0.2 }}>
                  <div
                    style={{
                      fontFamily: fontStackSans(theme),
                      fontSize: scale.caption * 0.75,
                      fontWeight: 700,
                      color: theme.textSubtle,
                      textAlign: isLeft ? "left" : "right",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {line.speaker}
                  </div>
                  <div
                    style={{
                      background: isLeft ? theme.surface : theme.primary,
                      color: isLeft ? theme.text : "#fff",
                      borderRadius: theme.radius * 1.2,
                      border: `2px solid ${isLeft ? theme.border : theme.primary}`,
                      padding: scale.gap * 0.65,
                      display: "grid",
                      gap: scale.gap * 0.22,
                    }}
                  >
                    <div style={{ fontFamily: fontStackJa(theme), fontSize: scale.body * 0.95, fontWeight: 600, lineHeight: 1.4 }}>
                      {line.ja}
                    </div>
                    <div
                      style={{
                        fontFamily: fontStackSans(theme),
                        fontSize: scale.caption * 0.82,
                        color: isLeft ? theme.textMuted : "rgba(255,255,255,0.85)",
                      }}
                    >
                      {line.en}
                    </div>
                  </div>
                </div>
              </div>
            </FadeUp>
          );
        })}
      </div>
    </SceneFrame>
  );
};

export const ReadingPassageScene: React.FC<{ visual: ReadingPassageVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Long passages scroll rather than shrink; type below ~28px is unreadable on a phone.
  const scrollY = visual.scroll
    ? interpolate(frame, [Math.round(durationInFrames * 0.12), durationInFrames], [0, -40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  return (
    <SceneFrame justify={visual.scroll ? "flex-start" : "center"}>
      {visual.title ? (
        <FadeUp>
          <div style={{ fontFamily: fontStackSerif(theme), fontSize: scale.title * 0.9, fontWeight: 700, color: theme.text }}>
            {visual.title}
          </div>
        </FadeUp>
      ) : null}
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${scrollY}%)` }}>
          <Surface style={{ width: "100%" }}>
            <div style={{ fontFamily: fontStackJa(theme), fontSize: scale.body, lineHeight: 1.85, color: theme.text }}>
              {visual.passageJa}
            </div>
            {visual.passageEn ? (
              <div
                style={{
                  marginTop: scale.gap * 0.6,
                  paddingTop: scale.gap * 0.6,
                  borderTop: `2px solid ${theme.border}`,
                  fontFamily: fontStackSans(theme),
                  fontSize: scale.caption * 0.9,
                  color: theme.textMuted,
                  lineHeight: 1.5,
                }}
              >
                {visual.passageEn}
              </div>
            ) : null}
          </Surface>
        </div>
      </div>
    </SceneFrame>
  );
};

export const ListeningPromptScene: React.FC<{ visual: ListeningPromptVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const thinkFrames = Math.round((visual.thinkingSeconds ?? 0) * fps);
  const revealFrame = Math.max(0, durationInFrames - Math.round(fps * 1.6));
  const revealed = frame >= revealFrame;
  const countdown = thinkFrames > 0 ? Math.max(0, Math.ceil((revealFrame - frame) / fps)) : 0;

  return (
    <SceneFrame>
      <FadeUp>
        <Eyebrow>Listen</Eyebrow>
      </FadeUp>
      <FadeUp delay={6}>
        <div
          style={{
            fontFamily: fontStackSerif(theme),
            fontSize: scale.title * 0.95,
            fontWeight: 700,
            color: theme.text,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {visual.prompt}
        </div>
      </FadeUp>

      {countdown > 0 && !revealed ? (
        <div
          style={{
            fontFamily: fontStackSans(theme),
            fontSize: scale.headline,
            fontWeight: 800,
            color: theme.primary,
          }}
        >
          {countdown}
        </div>
      ) : null}

      {revealed && visual.answer ? (
        <FadeUp>
          <Surface style={{ borderColor: theme.accent, width: "100%", textAlign: "center" }}>
            <JapaneseText text={visual.answer} size={scale.body * 1.15} weight={700} style={{ textAlign: "center" }} />
          </Surface>
        </FadeUp>
      ) : null}

      {revealed && visual.transcriptJa ? (
        <FadeUp delay={4}>
          <div style={{ fontFamily: fontStackJa(theme), fontSize: scale.caption * 0.95, color: theme.textMuted, textAlign: "center", lineHeight: 1.6 }}>
            {visual.transcriptJa}
          </div>
        </FadeUp>
      ) : null}
    </SceneFrame>
  );
};

/**
 * The frame the answer appears on.
 *
 * Exported and pure so it can be ASSERTED. `thinkingSeconds` was declared on QuizQuestionVisual
 * from the start and never read — the reveal came from scene length alone, so setting the field did
 * nothing. A recall round is precisely an instruction to wait a given number of seconds, so a test
 * has to be able to prove the number moves the reveal. Buried inside the component body it could
 * only be checked by rendering and looking.
 *
 * Measured from when the question is legible, not from frame 0: the question and options stagger in
 * over ~0.6s, and starting the clock earlier gives less thinking time than promised.
 *
 * Clamped by the scene's length, so asking for four seconds inside a three-second scene still
 * leaves time to read the answer instead of never revealing it.
 */
export function quizRevealFrame(thinkingSeconds: number | undefined, durationInFrames: number, fps: number): number {
  const legible = Math.round(fps * 0.6);
  const minAnswer = Math.round(fps * 1.4);
  const asked = legible + Math.round((thinkingSeconds ?? 2) * fps);
  return Math.max(legible, Math.min(asked, durationInFrames - minAnswer));
}

export const QuizQuestionScene: React.FC<{ visual: QuizQuestionVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  /**
   * When the answer appears.
   *
   * `thinkingSeconds` was declared on QuizQuestionVisual from the start and NEVER READ — the reveal
   * was derived purely from scene length, so setting the field did nothing and a "give them two
   * seconds to answer" instruction was silently ignored. A recall round is exactly that instruction,
   * so the field has to mean something.
   *
   * It is measured from the moment the question is legible rather than from frame 0: the question
   * and its options stagger in over the first ~0.6s, and starting the clock before the viewer can
   * read the question gives them less thinking time than the number promises.
   *
   * Still clamped by the scene's own length. A caller asking for four seconds of thinking inside a
   * three-second scene gets a reveal that at least leaves time to read the answer, rather than one
   * that never fires.
   */
  const revealFrame = quizRevealFrame(visual.thinkingSeconds, durationInFrames, fps);
  const revealed = frame >= revealFrame;
  const countdown = Math.max(0, Math.ceil((revealFrame - frame) / fps));

  return (
    <SceneFrame>
      <FadeUp>
        <Chip tone="accent">Quick check</Chip>
      </FadeUp>
      <FadeUp delay={5}>
        <div
          style={{
            fontFamily: fontStackSerif(theme),
            fontSize: scale.title * 0.92,
            fontWeight: 700,
            color: theme.text,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {visual.question}
        </div>
      </FadeUp>

      <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.4 }}>
        {visual.options.map((option, i) => {
          const correct = revealed && i === visual.correctIndex;
          const wrong = revealed && i !== visual.correctIndex;
          return (
            <FadeUp key={i} delay={10 + i * 5}>
              <Surface
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: scale.gap * 0.5,
                  padding: scale.gap * 0.65,
                  borderColor: correct ? theme.accent : theme.border,
                  background: correct ? `${theme.accent}1A` : theme.surface,
                  opacity: wrong ? 0.42 : 1,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: scale.body * 1.35,
                    height: scale.body * 1.35,
                    borderRadius: 999,
                    background: correct ? theme.accent : theme.border,
                    color: correct ? "#fff" : theme.textMuted,
                    fontFamily: fontStackSans(theme),
                    fontSize: scale.body * 0.62,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <JapaneseText text={option} size={scale.body * 0.9} weight={600} />
              </Surface>
            </FadeUp>
          );
        })}
      </div>

      {!revealed && countdown > 0 ? (
        <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.title, fontWeight: 800, color: theme.primary }}>
          {countdown}
        </div>
      ) : null}

      {revealed && visual.explanation ? (
        <FadeUp>
          <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.9, color: theme.textMuted, textAlign: "center", lineHeight: 1.45 }}>
            {visual.explanation}
          </div>
        </FadeUp>
      ) : null}
    </SceneFrame>
  );
};
