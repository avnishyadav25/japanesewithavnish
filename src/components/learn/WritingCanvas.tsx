"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CharacterType = "kanji" | "hiragana" | "katakana";

type Point = { x: number; y: number };
type Stroke = { points: Point[] };

type WritingCanvasProps = {
  character: string;
  characterType: CharacterType;
  expectedStrokeCount?: number | null;
  reading?: string | null;
  onVerify?: (result: { correct: boolean; feedback: string }) => void;
  className?: string;
};

export function WritingCanvas({
  character,
  characterType,
  expectedStrokeCount,
  reading,
  onVerify,
  className = "",
}: WritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const getPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      if (!t) return null;
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D, strokesToDraw: Stroke[], current: Point[]) => {
    ctx.strokeStyle = "var(--charcoal, #1a1a1a)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesToDraw) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    if (current.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(current[0].x, current[0].y);
      for (let i = 1; i < current.length; i++) {
        ctx.lineTo(current[i].x, current[i].y);
      }
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStrokes(ctx, strokes, currentStroke);
  }, [strokes, currentStroke, drawStrokes]);

  const handleStart = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pt = getPoint(e);
      if (pt) {
        setIsDrawing(true);
        setCurrentStroke([pt]);
        setResult(null);
      }
    },
    [getPoint]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawing) return;
      const pt = getPoint(e);
      if (pt) setCurrentStroke((prev) => [...prev, pt]);
    },
    [isDrawing, getPoint]
  );

  const handleEnd = useCallback(() => {
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, { points: currentStroke }]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  }, [currentStroke]);

  const handleVerify = useCallback(async () => {
    const allStrokes = currentStroke.length > 0 ? [...strokes, { points: currentStroke }] : strokes;
    if (allStrokes.length === 0) {
      setResult({ correct: false, feedback: "Draw at least one stroke first." });
      return;
    }
    setVerifying(true);
    setResult(null);
    try {
      const res = await fetch("/api/learn/writing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character,
          characterType,
          strokes: allStrokes.map((s) => ({ points: s.points })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ correct: false, feedback: data.error || "Verification failed." });
        onVerify?.({ correct: false, feedback: data.error || "Verification failed." });
        return;
      }
      const correct = Boolean(data.correct);
      const feedback = data.feedback || (correct ? "Correct!" : "Try again.");
      setResult({ correct, feedback });
      onVerify?.({ correct, feedback });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setResult({ correct: false, feedback: msg });
      onVerify?.({ correct: false, feedback: msg });
    } finally {
      setVerifying(false);
    }
  }, [character, characterType, strokes, currentStroke, onVerify]);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
    setResult(null);
  }, []);

  const handleReadAloud = useCallback(() => {
    const text = character;
    if (typeof window !== "undefined" && "speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  }, [character]);

  const size = 280;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className="text-4xl font-medium text-charcoal" aria-hidden>{character}</span>
        {reading && <span className="text-secondary text-sm">({reading})</span>}
        <button
          type="button"
          onClick={handleReadAloud}
          className="text-sm text-primary font-medium hover:underline"
          aria-label="Read aloud"
        >
          Read aloud
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border-2 border-[var(--divider)] rounded-bento bg-white touch-none cursor-crosshair"
        style={{ width: size, height: size }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        role="img"
        aria-label={`Writing practice for ${character}`}
      />
      <div className="flex gap-2 flex-wrap justify-center">
        <button type="button" onClick={handleVerify} disabled={verifying} className="btn-primary text-sm py-2 px-4">
          {verifying ? "Checking…" : "Check"}
        </button>
        <button type="button" onClick={handleClear} className="px-4 py-2 border border-[var(--divider)] rounded-bento text-sm hover:bg-[var(--divider)]/20">
          Clear
        </button>
      </div>
      {result && (
        <p className={`text-sm font-medium ${result.correct ? "text-green-600" : "text-primary"}`} role="status">
          {result.feedback}
        </p>
      )}
      {expectedStrokeCount != null && (
        <p className="text-xs text-secondary">Expected strokes: {expectedStrokeCount}</p>
      )}
    </div>
  );
}
