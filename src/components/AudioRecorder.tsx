"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { BrowserSupportWarning } from "@/components/BrowserSupportWarning";

export type RecordingResult = {
  blob: Blob;
  url: string;
  durationSec: number;
  size: number;
  mimeType: string;
  fileName: string;
};

type RecState = "idle" | "recording" | "paused" | "stopped";

export function AudioRecorder({
  onReady,
  disabled,
}: {
  onReady: (r: RecordingResult | null) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (result?.url) URL.revokeObjectURL(result.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTimer() {
    stopTimer();
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleStart() {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser tidak mendukung perekaman audio.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        const r: RecordingResult = {
          blob,
          url,
          durationSec: elapsed,
          size: blob.size,
          mimeType: type,
          fileName: `recording-${Date.now()}.${type.includes("webm") ? "webm" : "ogg"}`,
        };
        setResult(r);
        onReady(r);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = mr;
      mr.start(250);
      setElapsed(0);
      setResult(null);
      onReady(null);
      setState("recording");
      startTimer();
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Izin microphone ditolak. Aktifkan izin di browser, lalu coba lagi."
          : e?.message || "Tidak dapat mengakses microphone.";
      setError(msg);
      setState("idle");
    }
  }

  function handlePause() {
    mediaRecorderRef.current?.pause();
    stopTimer();
    setState("paused");
  }
  function handleResume() {
    mediaRecorderRef.current?.resume();
    startTimer();
    setState("recording");
  }
  function handleStop() {
    mediaRecorderRef.current?.stop();
    stopTimer();
    setState("stopped");
  }
  function handleDiscard() {
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setElapsed(0);
    setState("idle");
    onReady(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {state === "recording" && (
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulseRing" />
          )}
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${
              state === "recording"
                ? "bg-red-500 text-white"
                : state === "paused"
                ? "bg-amber-500 text-white"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Mic className="h-9 w-9" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={
              state === "recording"
                ? "destructive"
                : state === "paused"
                ? "warning"
                : "outline"
            }
          >
            {state === "recording" && "● Recording"}
            {state === "paused" && "❚❚ Paused"}
            {state === "stopped" && "■ Stopped"}
            {state === "idle" && "Idle"}
          </Badge>
          <span className="font-mono text-2xl tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {state === "idle" && (
            <Button onClick={handleStart} disabled={disabled} size="lg">
              <Mic className="h-4 w-4" /> Start Recording
            </Button>
          )}
          {state === "recording" && (
            <>
              <Button onClick={handlePause} variant="secondary">
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button onClick={handleStop} variant="destructive">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {state === "paused" && (
            <>
              <Button onClick={handleResume}>
                <Play className="h-4 w-4" /> Resume
              </Button>
              <Button onClick={handleStop} variant="destructive">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {state === "stopped" && (
            <>
              <Button onClick={handleStart} variant="secondary">
                <Mic className="h-4 w-4" /> Rekam Ulang
              </Button>
              <Button onClick={handleDiscard} variant="ghost">
                <Trash2 className="h-4 w-4" /> Buang
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <BrowserSupportWarning message={error} tone="error" />}

      {result && (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-xs text-muted-foreground">Preview rekaman</p>
          <audio src={result.url} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
