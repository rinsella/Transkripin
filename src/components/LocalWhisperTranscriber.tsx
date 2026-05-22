"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OutputMode } from "@/components/OutputModeSelector";
import { LANGUAGES } from "@/components/LanguageSelector";
import {
  LoadingModelStatus,
  type ModelLoadStatus,
} from "@/components/LoadingModelStatus";
import { BrowserSupportWarning } from "@/components/BrowserSupportWarning";
import { decodeAudioToMono16k } from "@/lib/audio";
import { formatDuration } from "@/lib/utils";

export type WhisperModelId =
  | "Xenova/whisper-tiny"
  | "Xenova/whisper-base"
  | "Xenova/whisper-tiny.en"
  | "Xenova/whisper-base.en";

export type LocalTranscribeResult = {
  text: string;
  chunks?: { text: string; timestamp: [number, number | null] }[];
  language: string;
  modelId: WhisperModelId;
};

const MODELS: { value: WhisperModelId; label: string; size: string }[] = [
  { value: "Xenova/whisper-tiny", label: "Whisper Tiny (multilingual)", size: "~75 MB" },
  { value: "Xenova/whisper-base", label: "Whisper Base (multilingual)", size: "~145 MB" },
  { value: "Xenova/whisper-tiny.en", label: "Whisper Tiny (English-only)", size: "~75 MB" },
  { value: "Xenova/whisper-base.en", label: "Whisper Base (English-only)", size: "~145 MB" },
];

function formatTimestamp(t: number | null | undefined): string {
  if (t == null || !isFinite(t)) return "??:??";
  return formatDuration(Math.max(0, t));
}

function formatOutput(
  text: string,
  chunks: { text: string; timestamp: [number, number | null] }[] | undefined,
  mode: OutputMode
): string {
  if (mode === "timestamped" && chunks && chunks.length > 0) {
    return chunks
      .map((c) => {
        const [start, end] = c.timestamp;
        return `[${formatTimestamp(start)} → ${formatTimestamp(end)}] ${c.text}`;
      })
      .join("\n");
  }
  if (mode === "paragraph") {
    const cleaned = text.replace(/\s+/g, " ").trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const paragraphs: string[] = [];
    for (let i = 0; i < sentences.length; i += 4) {
      paragraphs.push(sentences.slice(i, i + 4).join(" "));
    }
    return paragraphs.join("\n\n");
  }
  return text;
}

export function LocalWhisperTranscriber({
  file,
  language,
  outputMode,
  onResult,
  disabled,
}: {
  file: Blob | null;
  language: string;
  outputMode: OutputMode;
  onResult: (r: LocalTranscribeResult) => void;
  disabled?: boolean;
}) {
  const [modelId, setModelId] = useState<WhisperModelId>("Xenova/whisper-tiny");
  const [status, setStatus] = useState<ModelLoadStatus>({ stage: "idle" });
  const workerRef = useRef<Worker | null>(null);

  // Lazily create the worker on the client only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (workerRef.current) return;
    workerRef.current = new Worker(
      new URL("../workers/transcribe.worker.ts", import.meta.url),
      { type: "module" }
    );
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  async function run() {
    if (!file) {
      toast.error("Belum ada file audio.");
      return;
    }
    const worker = workerRef.current;
    if (!worker) {
      toast.error("Worker belum siap. Coba lagi.");
      return;
    }

    setStatus({ stage: "loading", message: "Decoding audio ke PCM 16 kHz…" });

    let pcm: Float32Array;
    try {
      pcm = await decodeAudioToMono16k(file);
    } catch (e: any) {
      const msg = e?.message ?? "Gagal decode audio.";
      setStatus({ stage: "error", message: msg });
      toast.error(msg);
      return;
    }

    const langObj = LANGUAGES.find((l) => l.value === language);
    const useTimestamps = outputMode === "timestamped";

    setStatus({ stage: "loading", message: "Mengirim audio ke worker…" });

    await new Promise<void>((resolve) => {
      const onMessage = (ev: MessageEvent<any>) => {
        const m = ev.data;
        if (!m) return;
        if (m.type === "progress") {
          if (m.status === "downloading") {
            setStatus({
              stage: "downloading",
              message: m.message,
              progress: m.progress,
              file: m.file,
            });
          } else if (m.status === "loading_model") {
            setStatus({
              stage: "loading",
              message: m.message,
              file: m.file,
            });
          } else if (m.status === "transcribing" || m.status === "chunk") {
            const detail =
              m.chunkTotal && m.chunkIndex !== undefined
                ? ` (segmen ${m.chunkIndex + 1} / ${m.chunkTotal})`
                : "";
            setStatus({
              stage: "transcribing",
              message: (m.message ?? "Transkripsi berjalan…") + detail,
            });
          } else if (m.status === "done") {
            setStatus({ stage: "ready", message: m.message });
          }
        } else if (m.type === "result") {
          worker.removeEventListener("message", onMessage);
          const formatted = formatOutput(m.text, m.chunks, outputMode);
          onResult({
            text: formatted,
            chunks: m.chunks,
            language: langObj?.value ?? "auto",
            modelId,
          });
          toast.success("Transkripsi selesai");
          resolve();
        } else if (m.type === "error") {
          worker.removeEventListener("message", onMessage);
          setStatus({
            stage: "error",
            message: `${m.message}. Coba file lebih pendek atau model tiny.en.`,
          });
          toast.error("Transkripsi gagal");
          resolve();
        }
      };
      worker.addEventListener("message", onMessage);

      worker.postMessage({
        type: "transcribe",
        pcm,
        sampleRate: 16000,
        model: modelId,
        language: langObj?.whisper ?? null,
        returnTimestamps: useTimestamps,
      });
    });
  }

  const busy =
    status.stage === "loading" ||
    status.stage === "downloading" ||
    status.stage === "transcribing";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Model Whisper (lokal · gratis)
        </p>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => {
            const active = modelId === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setModelId(m.value)}
                disabled={busy}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/30 hover:bg-accent/40"
                } ${busy ? "opacity-50" : ""}`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-muted-foreground">{m.size}</div>
              </button>
            );
          })}
        </div>
      </div>

      <BrowserSupportWarning
        tone="info"
        message="Mode upload audio menjalankan model AI langsung di browser via Web Worker. Jika gagal, coba file lebih pendek, model whisper-tiny.en, atau browser Chrome/Edge terbaru. File panjang (>10 menit) bisa berat di browser."
      />

      <LoadingModelStatus status={status} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={disabled || busy || !file} size="lg">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Transkripsi Audio
        </Button>
        <Badge variant="outline" className="gap-1">
          <Cpu className="h-3 w-3" /> 100% di browser (Web Worker)
        </Badge>
      </div>
    </div>
  );
}
