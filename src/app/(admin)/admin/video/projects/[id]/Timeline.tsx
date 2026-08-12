"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { resolveSceneDuration } from "@/lib/video/timeline";
import type { Scene, Storyboard } from "@/lib/video/types";

/**
 * Horizontal scene timeline.
 *
 * Clip widths are proportional to real duration, so the strip is an honest picture of pacing —
 * a scene that takes eight seconds looks eight seconds long. Two interactions:
 *
 *   drag a clip   reorder scenes (@dnd-kit, already a project dependency)
 *   drag an edge  trim, which switches the scene to durationMode "fixed"
 *
 * Trimming has a real consequence worth surfacing in the UI: an `auto` scene sizes itself to
 * its narration, so pinning it shorter than the voiceover will clip the audio. That is
 * sometimes deliberate, so it is allowed — but the clip is marked, and the inspector says so.
 */

const MIN_SCENE_SECONDS = 0.5;
/** Pixels per second at zoom 1. */
const BASE_PPS = 26;

export interface TimelineProps {
  storyboard: Storyboard;
  selectedSceneId: string | null;
  currentSeconds: number;
  onSelect: (sceneId: string) => void;
  onSeek: (seconds: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onTrim: (sceneId: string, seconds: number) => void;
}

interface ClipModel {
  scene: Scene;
  index: number;
  start: number;
  duration: number;
}

const SCENE_TINTS: Record<string, string> = {
  title_card: "#7C8DB5",
  vocab_card: "#D0021B",
  vocab_list: "#B0324A",
  kanji_stroke: "#1A1A1A",
  kanji_detail: "#4A4A4A",
  kana_grid: "#6B7280",
  grammar_pattern: "#C8A35F",
  grammar_formation: "#A8843F",
  example_sentence: "#2F855A",
  dialogue: "#2C7A7B",
  reading_passage: "#4C51BF",
  listening_prompt: "#6B46C1",
  comparison: "#9F7AEA",
  tip_callout: "#DD6B20",
  common_mistake: "#C53030",
  culture_note: "#B7791F",
  quiz_question: "#805AD5",
  summary_recap: "#38A169",
  broll_page: "#0B7285",
  cta_outro: "#D0021B",
};

function tintFor(sceneType: string): string {
  return SCENE_TINTS[sceneType] ?? "#6B7280";
}

export function Timeline({
  storyboard,
  selectedSceneId,
  currentSeconds,
  onSelect,
  onSeek,
  onReorder,
  onTrim,
}: TimelineProps) {
  const [zoom, setZoom] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);
  const pps = BASE_PPS * zoom;

  const clips: ClipModel[] = useMemo(() => {
    let cursor = 0;
    return storyboard.scenes.map((scene, index) => {
      // Same function the worker's timeline stage uses, so the strip and the render agree on
      // how long every scene is.
      const duration = resolveSceneDuration(scene, 0.45);
      const clip = { scene, index, start: cursor, duration };
      cursor += duration;
      return clip;
    });
  }, [storyboard.scenes]);

  const total = clips.reduce((sum, c) => sum + c.duration, 0);

  const sensors = useSensors(
    // A small activation distance keeps a plain click on a clip from being read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = clips.findIndex((c) => c.scene.id === active.id);
      const to = clips.findIndex((c) => c.scene.id === over.id);
      if (from >= 0 && to >= 0) onReorder(from, to);
    },
    [clips, onReorder]
  );

  function seekFromClientX(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const seconds = (clientX - rect.left + track.scrollLeft) / pps;
    onSeek(Math.max(0, Math.min(total, seconds)));
  }

  return (
    <div className="border border-[var(--divider)] rounded-card bg-white">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--divider)]">
        <div className="text-xs text-secondary">
          {clips.length} scene{clips.length === 1 ? "" : "s"} · {total.toFixed(1)}s
          {!storyboard.resolved && " · provisional timing until the first render"}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">Zoom</span>
          <input
            type="range"
            min={0.4}
            max={4}
            step={0.2}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Timeline zoom"
            className="w-28"
          />
        </div>
      </div>

      <div ref={trackRef} className="overflow-x-auto px-3 py-3">
        <div style={{ width: Math.max(total * pps, 320), minWidth: "100%" }}>
          {/* Ruler doubles as the scrub target. */}
          <button
            type="button"
            onClick={(e) => seekFromClientX(e.clientX)}
            aria-label="Scrub timeline"
            className="relative block w-full h-5 mb-1 cursor-col-resize"
          >
            {Array.from({ length: Math.floor(total) + 1 }).map((_, second) =>
              // Label every second when zoomed in, every fifth when zoomed out, so ticks never
              // collide into an unreadable smear.
              second % (zoom >= 2 ? 1 : zoom >= 1 ? 5 : 10) === 0 ? (
                <span
                  key={second}
                  className="absolute top-0 text-[10px] text-subtle border-l border-[var(--divider)] pl-1 h-full"
                  style={{ left: second * pps }}
                >
                  {second}s
                </span>
              ) : null
            )}
          </button>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={clips.map((c) => c.scene.id)} strategy={horizontalListSortingStrategy}>
              <div className="relative flex items-stretch gap-[2px] h-20">
                {clips.map((clip) => (
                  <Clip
                    key={clip.scene.id}
                    clip={clip}
                    pps={pps}
                    selected={clip.scene.id === selectedSceneId}
                    onSelect={() => onSelect(clip.scene.id)}
                    onTrim={(seconds) => onTrim(clip.scene.id, seconds)}
                  />
                ))}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-charcoal pointer-events-none z-10"
                  style={{ left: currentSeconds * pps }}
                >
                  <div className="w-3 h-3 -ml-[5px] -mt-1 rotate-45 bg-charcoal" />
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

function Clip({
  clip,
  pps,
  selected,
  onSelect,
  onTrim,
}: {
  clip: ClipModel;
  pps: number;
  selected: boolean;
  onSelect: () => void;
  onTrim: (seconds: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.scene.id,
  });
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const tint = tintFor(clip.scene.sceneType);
  const width = dragWidth ?? clip.duration * pps;
  const isFixed = clip.scene.durationMode === "fixed";

  // Edge-drag trim. Bound to window rather than the element so the pointer can leave the clip
  // mid-drag without the resize sticking.
  const startTrim = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = clip.duration * pps;

      const move = (ev: PointerEvent) => {
        setDragWidth(Math.max(MIN_SCENE_SECONDS * pps, startWidth + (ev.clientX - startX)));
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const next = Math.max(MIN_SCENE_SECONDS, (startWidth + (ev.clientX - startX)) / pps);
        setDragWidth(null);
        if (Math.abs(next - clip.duration) > 0.05) onTrim(Number(next.toFixed(2)));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [clip.duration, pps, onTrim]
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        width,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        borderColor: selected ? "#1A1A1A" : "transparent",
      }}
      className="relative shrink-0 rounded-[6px] border-2 overflow-hidden select-none"
    >
      <button
        type="button"
        onClick={onSelect}
        {...attributes}
        {...listeners}
        className="w-full h-full text-left px-2 py-1.5 cursor-grab active:cursor-grabbing"
        style={{ background: `${tint}1A`, borderLeft: `4px solid ${tint}` }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: tint }}>
          {clip.scene.sceneType.replace(/_/g, " ")}
        </div>
        <div className="text-[11px] text-charcoal truncate">{clipLabel(clip.scene)}</div>
        <div className="text-[10px] text-subtle mt-0.5">
          {clip.duration.toFixed(1)}s{isFixed ? " · pinned" : ""}
        </div>
      </button>

      {/* Trim handle */}
      <div
        onPointerDown={startTrim}
        role="separator"
        aria-label={`Trim ${clip.scene.sceneType}`}
        className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-charcoal/20"
      />
    </div>
  );
}

function clipLabel(scene: Scene): string {
  const v = scene.visual as unknown as Record<string, unknown>;
  const item = v.item as { word?: string } | undefined;
  return (
    (typeof v.title === "string" && v.title) ||
    (typeof v.heading === "string" && v.heading) ||
    (typeof v.pattern === "string" && v.pattern) ||
    (typeof v.character === "string" && v.character) ||
    (typeof v.headline === "string" && v.headline) ||
    item?.word ||
    scene.narration.find((n) => n.text)?.text.slice(0, 40) ||
    "—"
  );
}

/** Keeps the playhead following the Player without a re-render per frame. */
export function usePlayerTime(playerRef: React.RefObject<{ getCurrentFrame: () => number } | null>, fps: number) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    // 10fps is plenty for a playhead and costs a fraction of a per-frame subscription.
    const timer = setInterval(() => {
      const frame = playerRef.current?.getCurrentFrame?.();
      if (typeof frame === "number") setSeconds(frame / fps);
    }, 100);
    return () => clearInterval(timer);
  }, [playerRef, fps]);
  return seconds;
}
