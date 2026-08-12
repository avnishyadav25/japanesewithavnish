import React from "react";
import type {
  ComparisonVisual,
  ExampleSentence,
  ExampleSentenceVisual,
  GrammarFormationVisual,
  GrammarPatternVisual,
  VocabCardVisual,
  VocabListVisual,
} from "@/lib/video/types";
import { useLayout } from "../LayoutContext";
import { fontStackJa, fontStackSans, fontStackSerif } from "../theme";
import { Chip, Eyebrow, FadeUp, JapaneseText, PopIn, SceneFrame, StepIndicator, Surface } from "../components/primitives";

/** Splits a Japanese sentence around the substrings worth emphasising (the target word or
 * grammar point), so the viewer's eye lands on the thing being taught rather than scanning the
 * whole sentence. Falls back to plain text when nothing matches. */
function HighlightedJa({ text, highlight, size }: { text: string; highlight?: string[]; size: number }) {
  const { theme } = useLayout();
  const terms = (highlight ?? []).filter((t) => t && text.includes(t));
  if (terms.length === 0) {
    return <JapaneseText text={text} size={size} weight={600} style={{ lineHeight: 1.5 }} />;
  }

  // Longest-first so an overlapping shorter term can't split a longer one mid-match.
  const pattern = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "g"));

  return (
    <div
      style={{
        fontFamily: fontStackJa(theme),
        fontSize: size,
        fontWeight: 600,
        color: theme.text,
        lineHeight: 1.5,
      }}
    >
      {parts.map((part, i) =>
        terms.includes(part) ? (
          <span
            key={i}
            style={{
              color: theme.primary,
              background: `${theme.primary}14`,
              borderRadius: 8,
              padding: "0 0.12em",
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

function ExampleBlock({ example, highlight, delay = 0 }: { example: ExampleSentence; highlight?: string[]; delay?: number }) {
  const { theme, scale } = useLayout();
  return (
    <FadeUp delay={delay}>
      <Surface style={{ display: "grid", gap: scale.gap * 0.32, width: "100%" }}>
        <HighlightedJa text={example.ja} highlight={highlight} size={scale.body * 0.98} />
        {example.romaji ? (
          <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.8, color: theme.textSubtle }}>
            {example.romaji}
          </div>
        ) : null}
        {example.en ? (
          <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.92, color: theme.textMuted }}>
            {example.en}
          </div>
        ) : null}
      </Surface>
    </FadeUp>
  );
}

export const VocabCardScene: React.FC<{ visual: VocabCardVisual }> = ({ visual }) => {
  const { theme, scale, layout } = useLayout();
  const { item } = visual;
  const twoColumn = layout === "landscape" && Boolean(item.example);

  const wordBlock = (
    <div style={{ display: "grid", gap: scale.gap * 0.45, justifyItems: twoColumn ? "start" : "center", textAlign: twoColumn ? "left" : "center" }}>
      <PopIn>
        <JapaneseText
          text={item.word}
          reading={visual.showFurigana ? item.reading : undefined}
          size={scale.displayJa}
          weight={800}
        />
      </PopIn>
      {item.romaji ? (
        <FadeUp delay={8}>
          <div
            style={{
              fontFamily: fontStackSans(theme),
              fontSize: scale.caption * 0.95,
              color: theme.textSubtle,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {item.romaji}
          </div>
        </FadeUp>
      ) : null}
      <FadeUp delay={14}>
        <div
          style={{
            fontFamily: fontStackSerif(theme),
            fontSize: scale.title,
            fontWeight: 700,
            color: theme.primary,
            lineHeight: 1.2,
          }}
        >
          {item.meaning}
        </div>
      </FadeUp>
      {item.partOfSpeech || item.transitivity ? (
        <FadeUp delay={20} style={{ display: "flex", gap: scale.gap * 0.35, flexWrap: "wrap", justifyContent: twoColumn ? "flex-start" : "center" }}>
          {item.partOfSpeech ? <Chip>{item.partOfSpeech}</Chip> : null}
          {item.transitivity ? <Chip>{item.transitivity}</Chip> : null}
        </FadeUp>
      ) : null}
    </div>
  );

  return (
    <SceneFrame>
      {visual.index && visual.total ? (
        <FadeUp>
          <StepIndicator index={visual.index} total={visual.total} />
        </FadeUp>
      ) : null}

      {twoColumn ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: scale.gap * 1.4, alignItems: "center", width: "100%" }}>
          {wordBlock}
          {item.example ? <ExampleBlock example={item.example} highlight={[item.word]} delay={26} /> : null}
        </div>
      ) : (
        <>
          {wordBlock}
          {item.example ? <ExampleBlock example={item.example} highlight={[item.word]} delay={26} /> : null}
        </>
      )}
    </SceneFrame>
  );
};

export const VocabListScene: React.FC<{ visual: VocabListVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  return (
    <SceneFrame>
      {visual.heading ? (
        <FadeUp>
          <div style={{ fontFamily: fontStackSerif(theme), fontSize: scale.title, fontWeight: 700, color: theme.text }}>
            {visual.heading}
          </div>
        </FadeUp>
      ) : null}
      <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.42 }}>
        {visual.items.slice(0, 8).map((item, i) => (
          <FadeUp key={i} delay={6 + i * 5} distance={16}>
            <Surface style={{ display: "flex", alignItems: "baseline", gap: scale.gap * 0.6, padding: scale.gap * 0.7 }}>
              <JapaneseText text={item.word} reading={item.reading} size={scale.body * 1.15} weight={700} />
              <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.9, color: theme.textMuted }}>
                {item.meaning}
              </div>
            </Surface>
          </FadeUp>
        ))}
      </div>
    </SceneFrame>
  );
};

export const GrammarPatternScene: React.FC<{ visual: GrammarPatternVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  return (
    <SceneFrame>
      {visual.level ? (
        <FadeUp>
          <Eyebrow>JLPT {visual.level}</Eyebrow>
        </FadeUp>
      ) : null}
      <PopIn delay={4}>
        <JapaneseText text={visual.pattern} reading={visual.reading} size={scale.headline * 1.15} weight={800} />
      </PopIn>
      <FadeUp delay={12}>
        <div
          style={{
            fontFamily: fontStackSerif(theme),
            fontSize: scale.title * 0.92,
            fontWeight: 700,
            color: theme.primary,
            textAlign: "center",
            lineHeight: 1.22,
          }}
        >
          {visual.meaning}
        </div>
      </FadeUp>
      {visual.structure ? (
        <FadeUp delay={20}>
          <Surface style={{ width: "100%", textAlign: "center", background: theme.bg }}>
            <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.75, color: theme.textSubtle, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: scale.gap * 0.3 }}>
              Structure
            </div>
            <JapaneseText text={visual.structure} size={scale.body} weight={600} style={{ textAlign: "center" }} />
          </Surface>
        </FadeUp>
      ) : null}
      {visual.whenToUse ? (
        <FadeUp delay={28}>
          <div
            style={{
              fontFamily: fontStackSans(theme),
              fontSize: scale.caption * 0.95,
              color: theme.textMuted,
              textAlign: "center",
              lineHeight: 1.45,
            }}
          >
            {visual.whenToUse}
          </div>
        </FadeUp>
      ) : null}
    </SceneFrame>
  );
};

export const GrammarFormationScene: React.FC<{ visual: GrammarFormationVisual }> = ({ visual }) => {
  const { theme, scale } = useLayout();
  return (
    <SceneFrame>
      <FadeUp>
        <JapaneseText text={visual.pattern} size={scale.title} weight={800} />
      </FadeUp>
      <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.5 }}>
        {visual.steps.map((step, i) => (
          <FadeUp key={i} delay={8 + i * 10} distance={20}>
            <Surface style={{ display: "grid", gap: scale.gap * 0.3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: scale.gap * 0.5, flexWrap: "wrap" }}>
                <JapaneseText text={step.from} size={scale.body} weight={600} color={theme.textMuted} />
                <span style={{ fontSize: scale.body, color: theme.primary, fontWeight: 800 }}>→</span>
                <JapaneseText text={step.to} size={scale.body} weight={700} color={theme.primary} />
              </div>
              <div style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.82, color: theme.textSubtle }}>
                {step.rule}
              </div>
            </Surface>
          </FadeUp>
        ))}
      </div>
    </SceneFrame>
  );
};

export const ExampleSentenceScene: React.FC<{ visual: ExampleSentenceVisual }> = ({ visual }) => {
  const { scale } = useLayout();
  return (
    <SceneFrame>
      {visual.heading ? (
        <FadeUp>
          <Eyebrow>{visual.heading}</Eyebrow>
        </FadeUp>
      ) : null}
      <div style={{ width: "100%", display: "grid", gap: scale.gap * 0.55 }}>
        {visual.sentences.map((sentence, i) => (
          <ExampleBlock key={i} example={sentence} highlight={visual.highlight} delay={4 + i * 12} />
        ))}
      </div>
    </SceneFrame>
  );
};

export const ComparisonScene: React.FC<{ visual: ComparisonVisual }> = ({ visual }) => {
  const { theme, scale, layout } = useLayout();
  const column = (side: ComparisonVisual["left"], tint: string, delay: number) => (
    <FadeUp delay={delay}>
      <Surface style={{ display: "grid", gap: scale.gap * 0.4, height: "100%", borderColor: tint }}>
        <JapaneseText text={side.label} size={scale.body * 1.1} weight={700} color={tint} />
        {side.points.map((point, i) => (
          <div key={i} style={{ fontFamily: fontStackSans(theme), fontSize: scale.caption * 0.88, color: theme.textMuted, lineHeight: 1.4 }}>
            • {point}
          </div>
        ))}
      </Surface>
    </FadeUp>
  );

  return (
    <SceneFrame>
      {visual.heading ? (
        <FadeUp>
          <div style={{ fontFamily: fontStackSerif(theme), fontSize: scale.title, fontWeight: 700, color: theme.text, textAlign: "center" }}>
            {visual.heading}
          </div>
        </FadeUp>
      ) : null}
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: layout === "vertical" ? "1fr" : "1fr 1fr",
          gap: scale.gap * 0.6,
        }}
      >
        {column(visual.left, theme.primary, 6)}
        {column(visual.right, theme.accent, 14)}
      </div>
    </SceneFrame>
  );
};
