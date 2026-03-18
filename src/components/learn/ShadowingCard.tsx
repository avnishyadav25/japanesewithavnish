"use client";

import { useCallback, useRef, useState } from "react";

type ShadowingCardProps = {
  audioUrl: string;
  title?: string;
  transcript?: string;
  className?: string;
};

export function ShadowingCard({ audioUrl, title, transcript, className = "" }: ShadowingCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const playNative = useCallback(() => {
    audioRef.current?.play();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const prev = recordedUrl;
          if (prev) URL.revokeObjectURL(prev);
          setRecordedUrl(URL.createObjectURL(blob));
        }
      };
      mr.start();
      setRecording(true);
      setRecordedUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    } catch (err) {
      console.error(err);
      alert("Microphone access is needed to record. Please allow and try again.");
    }
  }, [recordedUrl]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    setRecording(false);
  }, []);

  return (
    <div className={`rounded-bento border border-[var(--divider)] bg-white p-4 space-y-4 ${className}`}>
      {title && <h3 className="font-heading font-semibold text-charcoal">{title}</h3>}
      <div className="flex flex-wrap items-center gap-3">
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
        <button type="button" onClick={playNative} className="btn-primary text-sm py-2 px-4">
          Play native audio
        </button>
        {!recording ? (
          <button type="button" onClick={startRecording} className="px-4 py-2 border border-[var(--divider)] rounded-bento text-sm font-medium hover:bg-[var(--divider)]/20">
            Record my voice
          </button>
        ) : (
          <button type="button" onClick={stopRecording} className="px-4 py-2 rounded-bento text-sm font-medium bg-primary text-white">
            Stop recording
          </button>
        )}
        {recordedUrl && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">My recording:</span>
            <audio controls src={recordedUrl} className="h-8 max-w-[200px]" />
          </div>
        )}
      </div>
      {transcript && (
        <details className="text-sm">
          <summary className="cursor-pointer text-primary font-medium">Show transcript</summary>
          <p className="mt-2 text-charcoal whitespace-pre-wrap">{transcript}</p>
        </details>
      )}
    </div>
  );
}
