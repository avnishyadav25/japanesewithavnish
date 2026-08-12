import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { KanaGridVisual, KanjiDetailVisual, KanjiStrokeVisual } from "@/lib/video/types";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans, fontStackSerif } from "../theme";
import { Chip, Eyebrow, FadeUp, JapaneseText, PopIn, SceneFrame, Surface } from "../components/primitives";

/** KanjiVG ships every glyph on a 109x109 grid; WritingCanvas.tsx renders the same data
 * scaled to 280x280 on the site. */
const KANJIVG_VIEWBOX = 109;

/**
 * Animated stroke-order writing.
 *
 * Each path draws itself via strokeDashoffset. The usual way to do that needs the path's real
 * length from getTotalLength(), which means a DOM measurement and an async delayRender()
 * round-trip on every frame-seek. Instead each path declares `pathLength={1}`, which tells the
 * browser to treat its length as exactly 1 unit for dash math — so the dash values are pure
 * arithmetic, identical in the admin's <Player> and in the headless renderer, with no
 * measurement at all.
 */
const StrokeOrder: React.FC<{ paths: string[]; size: number; color: string; ghostColor: string }> = ({
  paths,
  size,
  color,
  ghostColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Reserve a beat at the start (so the empty grid registers) and a longer one at the end
  // (so the finished character is readable before the cut).
  const startFrame = Math.round(fps * 0.35);
  const holdFrames = Math.round(fps * 0.9);
  const drawWindow = Math.max(fps, durationInFrames - startFrame - holdFrames);
  const perStroke = drawWindow / Math.max(1, paths.length);

  const gridLine = (pos: number, vertical: boolean) => (
    <line
      key={`${vertical ? "v" : "h"}${pos}`}
      x1={vertical ? pos : 0}
      y1={vertical ? 0 : pos}
      x2={vertical ? pos : KANJIVG_VIEWBOX}
      y2={vertical ? KANJIVG_VIEWBOX : pos}
      stroke={ghostColor}
      strokeWidth={0.6}
      strokeDasharray="3 3"
    />
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${KANJIVG_VIEWBOX} ${KANJIVG_VIEWBOX}`}>
      {gridLine(KANJIVG_VIEWBOX / 2, true)}
      {gridLine(KANJIVG_VIEWBOX / 2, false)}
      <rect x={0} y={0} width={KANJIVG_VIEWBOX} height={KANJIVG_VIEWBOX} fill="none" stroke={ghostColor} strokeWidth={0.8} />

      {/* Ghost of the finished glyph, so the viewer can see where a stroke is heading. */}
      {paths.map((d, i) => (
        <path key={`ghost-${i}`} d={d} fill="none" stroke={ghostColor} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {paths.map((d, i) => {
        const strokeStart = startFrame + i * perStroke;
        const progress = interpolate(frame, [strokeStart, strokeStart + perStroke], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <path
            key={`stroke-${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={4.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - progress}
          />
        );
      })}
    </svg>
  );
};

export const KanjiStrokeScene: React.FC<{ visual: KanjiStrokeVisual }> = ({ visual }) => {
  const { theme, scale, layout } = useLayout();
  const hasStrokes = visual.strokePaths.length > 0;
  const glyphSize = layout === "landscape" ? scale.displayJa * 2.1 : scale.displayJa * 2.4;

  const readings = (
    <div style={{ display: "grid", gap: scale.gap * 0.35, width: "100%" }}>
      {visual.onyomi.length > 0 ? (
        <FadeUp delay={20}>
          <Surface style={{ display: "flex", alignItems: "center", gap: scale.gap * 0.5, padding: scale.gap * 0.6 }}>
            <Chip tone="accent">On</Chip>
            <div style={{ fontFamily: fontStackJa(theme), fontSize: scale.body, fontWeight: 600, color: theme.text }}>
              {visual.onyomi.join("、")}
            </div>
          </Surface>
        </FadeUp>
      ) : null}
      {visual.kunyomi.length > 0 ? (
        <FadeUp delay={26}>
          <Surface style={{ display: "flex", alignItems: "center", gap: scale.gap * 0.5, padding: scale.gap * 0.6 }}>
            <Chip>Kun</Chip>
            <div style={{ fontFamily: fontStackJa(theme), fontSize: scale.body, fontWeight: 600, color: theme.text }}>
              {visual.kunyomi.join("、")}
            </div>
          </Surface>
        </FadeUp>
      ) : null}
    </div>
  );

  const glyph = hasStrokes ? (
    <StrokeOrder paths={visual.strokePaths} size={glyphSize} color={theme.text} ghostColor={theme.border} />
  ) : (
    // Not every kanji has stroke_data backfilled; fall back to the glyph itself rather than
    // rendering an empty grid.
    <PopIn>
      <JapaneseText text={visual.character} size={glyphSize * 0.78} weight={800} />
    </PopIn>
  );

  return (
    <SceneFrame>
      <FadeUp>
        <Eyebrow>
          {visual.strokeCount ? `${visual.strokeCount} strokes` : "Kanji"}
        </Eyebrow>
      </FadeUp>

      {layout === "landscape" ? (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: scale.gap * 1.5, alignItems: "center", width: "100%" }}>
          <div>{glyph}</div>
          <div style={{ display: "grid", gap: scale.gap * 0.6 }}>
            <FadeUp delay={12}>
              <div style={{ fontFamily: fontStackSerif(theme), fontSize: scale.title, fontWeight: 700, color: theme.primary }}>
                {visual.meaning}
              </div>
            </FadeUp>
            {readings}
          </div>
        </div>
      ) : (
        <>
          {glyph}
          <FadeUp delay={12}>
            <div
              style={{
                fontFamily: fontStackSerif(theme),
                fontSize: scale.title,
                fontWeight: 700,
                color: theme.primary,
                textAlign: "center",
              }}
            >
              {visual.meaning}
            </div>
          </FadeUp>
          {readings}
        </>
      )}
    </SceneFrame>
  );
};

export const KanjiDetailScene: React.FC<{ visual: KanjiDetailVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  return (
    <SceneFrame>
      <PopIn>
        <JapaneseText text={visual.character} size={scale.displayJa} weight={800} />
      </PopIn>
      <FadeUp delay={8}>
        <div style={{ fontFamily: fontStackSerif(theme), fontSize: scale.title * 0.9, fontWeight: 700, color: theme.primary }}>
          {visual.meaning}
        </div>
      </FadeUp>

      {visual.radicals?.length ? (
        <FadeUp delay={16}>
          <Surface style={{ width: "100%", display: "grid", gap: scale.gap * 0.4 }}>
            <Eyebrow>Built from</Eyebrow>
            <div style={{ display: "flex", gap: scale.gap * 0.6, flexWrap: "wrap" }}>
              {visual.radicals.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: scale.gap * 0.25 }}>
                  <JapaneseText text={r.character} size={scale.body * 1.3} weight={700} />
                  <span style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.8, color: theme.textMuted }}>
                    {r.meaning}
                  </span>
                </div>
              ))}
            </div>
          </Surface>
        </FadeUp>
      ) : null}

      {visual.similar?.length ? (
        <FadeUp delay={24}>
          <Surface style={{ width: "100%", display: "grid", gap: scale.gap * 0.4, borderColor: theme.primary }}>
            <Eyebrow>Don&apos;t confuse with</Eyebrow>
            {visual.similar.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: scale.gap * 0.4 }}>
                <JapaneseText text={s.character} size={scale.body * 1.25} weight={700} color={theme.primary} />
                <span style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.82, color: theme.textMuted }}>
                  {s.meaning} — {s.distinction}
                </span>
              </div>
            ))}
          </Surface>
        </FadeUp>
      ) : null}

      {visual.mnemonic ? (
        <FadeUp delay={32}>
          <div
            style={{
              fontFamily: fontStackSans(theme),
              fontSize: scale.caption * 0.95,
              color: theme.textMuted,
              fontStyle: "italic",
              textAlign: "center",
              lineHeight: 1.45,
            }}
          >
            {visual.mnemonic}
          </div>
        </FadeUp>
      ) : null}
    </SceneFrame>
  );
};

export const KanaGridScene: React.FC<{ visual: KanaGridVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  const columns = Math.min(5, Math.max(1, visual.characters.length));

  return (
    <SceneFrame>
      <FadeUp>
        <Eyebrow>{visual.kind === "hiragana" ? "Hiragana" : "Katakana"}{visual.rowLabel ? ` · ${visual.rowLabel}` : ""}</Eyebrow>
      </FadeUp>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: scale.gap * 0.5, width: "100%" }}>
        {visual.characters.map((char, i) => {
          const focused = visual.focusIndex === i;
          return (
            <FadeUp key={i} delay={6 + i * 4}>
              <Surface
                style={{
                  display: "grid",
                  gap: scale.gap * 0.2,
                  justifyItems: "center",
                  padding: scale.gap * 0.6,
                  borderColor: focused ? theme.primary : theme.border,
                  background: focused ? `${theme.primary}0D` : theme.surface,
                }}
              >
                <JapaneseText
                  text={char.character}
                  size={scale.title * 1.1}
                  weight={700}
                  color={focused ? theme.primary : theme.text}
                />
                <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.72, color: theme.textSubtle, letterSpacing: "0.08em" }}>
                  {char.romaji}
                </div>
              </Surface>
            </FadeUp>
          );
        })}
      </div>
    </SceneFrame>
  );
};
