import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CalloutVisual, CtaOutroVisual, SummaryRecapVisual, TitleCardVisual } from "@/lib/video/types";
import { useLayout } from "../LayoutContext";
import { fontStackSans, fontStackSerif } from "../theme";
import { Chip, Eyebrow, FadeUp, JapaneseText, SceneFrame, Surface } from "../components/primitives";

export const TitleCardScene: React.FC<{ visual: TitleCardVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const frame = useCurrentFrame();
  // A very slow zoom keeps a mostly-static title card from reading as a frozen frame.
  const zoom = interpolate(frame, [0, 150], [1, 1.05], { extrapolateRight: "clamp" });

  return (
    <SceneFrame>
      <div style={{ transform: `scale(${zoom})`, textAlign: "center", display: "grid", gap: scale.gap }}>
        {visual.eyebrow ? (
          <FadeUp>
            <Eyebrow>{visual.eyebrow}</Eyebrow>
          </FadeUp>
        ) : null}
        <FadeUp delay={5}>
          <div
            style={{
              fontFamily: fontStackSerif(theme),
              fontSize: scale.headline,
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1.12,
            }}
          >
            {visual.title}
          </div>
        </FadeUp>
        {visual.subtitle ? (
          <FadeUp delay={12}>
            <div
              style={{
                fontFamily: fontStackSans(theme),
                fontSize: scale.body,
                color: theme.textMuted,
                lineHeight: 1.4,
              }}
            >
              {visual.subtitle}
            </div>
          </FadeUp>
        ) : null}
        <FadeUp delay={18} style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: scale.gap * 3, height: 6, borderRadius: 999, background: theme.primary }} />
        </FadeUp>
      </div>
    </SceneFrame>
  );
};

export const SummaryRecapScene: React.FC<{ visual: SummaryRecapVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const { fps, durationInFrames } = useVideoConfig();
  // Stagger the reveal across the scene's own length so a 12-point recap doesn't finish
  // appearing in the first second of a 20-second scene, and a 3-point one isn't glacial.
  const perItem = Math.min(9, Math.max(3, Math.floor((durationInFrames - fps) / Math.max(1, visual.points.length))));

  return (
    <SceneFrame justify="center">
      <FadeUp>
        <div
          style={{
            fontFamily: fontStackSerif(theme),
            fontSize: scale.title,
            fontWeight: 700,
            color: theme.text,
            textAlign: "center",
          }}
        >
          {visual.heading}
        </div>
      </FadeUp>
      <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.5 }}>
        {visual.points.map((point, i) => (
          <FadeUp key={i} delay={8 + i * perItem} distance={18}>
            <Surface style={{ padding: scale.gap * 0.8, display: "flex", gap: scale.gap * 0.6, alignItems: "center" }}>
              <div
                style={{
                  flexShrink: 0,
                  width: scale.body * 1.5,
                  height: scale.body * 1.5,
                  borderRadius: 999,
                  background: theme.primary,
                  color: "#fff",
                  fontFamily: fontStackSans(theme),
                  fontSize: scale.body * 0.7,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <JapaneseText text={point} size={scale.body * 0.95} weight={600} style={{ lineHeight: 1.35 }} />
            </Surface>
          </FadeUp>
        ))}
      </div>
    </SceneFrame>
  );
};

export const CtaOutroScene: React.FC<{ visual: CtaOutroVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  return (
    <SceneFrame background={theme.primary}>
      <div style={{ textAlign: "center", display: "grid", gap: scale.gap * 0.7 }}>
        <FadeUp>
          <div
            style={{
              fontFamily: fontStackSans(theme),
              fontSize: scale.body,
              fontWeight: 600,
              color: "rgba(255,255,255,0.82)",
              letterSpacing: "0.04em",
            }}
          >
            {visual.headline}
          </div>
        </FadeUp>
        <FadeUp delay={6}>
          <div
            style={{
              fontFamily: fontStackSerif(theme),
              fontSize: scale.headline * 0.92,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.1,
            }}
          >
            {visual.subline}
          </div>
        </FadeUp>
        {visual.url ? (
          <FadeUp delay={14}>
            <div
              style={{
                fontFamily: fontStackSans(theme),
                fontSize: scale.body * 0.92,
                color: "#fff",
                background: "rgba(0,0,0,0.22)",
                borderRadius: 999,
                padding: `${scale.gap * 0.4}px ${scale.gap}px`,
                display: "inline-block",
              }}
            >
              {visual.url}
            </div>
          </FadeUp>
        ) : null}
      </div>
    </SceneFrame>
  );
};

export const CalloutScene: React.FC<{ visual: CalloutVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const isMistake = visual.sceneType === "common_mistake";
  const tint = isMistake ? theme.primary : visual.sceneType === "culture_note" ? theme.accent : theme.text;

  return (
    <SceneFrame>
      <FadeUp>
        <Chip tone="accent">
          {visual.sceneType === "common_mistake" ? "Common mistake" : visual.sceneType === "culture_note" ? "Culture note" : "Tip"}
        </Chip>
      </FadeUp>
      <FadeUp delay={6}>
        <div
          style={{
            fontFamily: fontStackSerif(theme),
            fontSize: scale.title,
            fontWeight: 700,
            color: theme.text,
            textAlign: "center",
            lineHeight: 1.18,
          }}
        >
          {visual.heading}
        </div>
      </FadeUp>

      {visual.wrong && visual.right ? (
        <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.5 }}>
          <FadeUp delay={12}>
            <Surface style={{ borderColor: theme.primary, display: "flex", gap: scale.gap * 0.5, alignItems: "center" }}>
              <span style={{ fontSize: scale.body * 1.1, color: theme.primary, fontWeight: 800 }}>✕</span>
              <JapaneseText
                text={visual.wrong}
                size={scale.body}
                color={theme.primary}
                style={{ textDecoration: "line-through" }}
              />
            </Surface>
          </FadeUp>
          <FadeUp delay={20}>
            <Surface style={{ borderColor: theme.accent, display: "flex", gap: scale.gap * 0.5, alignItems: "center" }}>
              <span style={{ fontSize: scale.body * 1.1, color: theme.accent, fontWeight: 800 }}>✓</span>
              <JapaneseText text={visual.right} size={scale.body} />
            </Surface>
          </FadeUp>
        </div>
      ) : null}

      <FadeUp delay={visual.wrong ? 28 : 14}>
        <div
          style={{
            fontFamily: fontStackSans(theme),
            fontSize: scale.body * 0.95,
            color: theme.textMuted,
            textAlign: "left",
            lineHeight: 1.45,
            borderLeft: `5px solid ${tint}`,
            paddingLeft: scale.gap * 0.6,
          }}
        >
          {visual.body}
        </div>
      </FadeUp>
    </SceneFrame>
  );
};
