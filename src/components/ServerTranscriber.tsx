"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Cpu, Loader2, Server, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { transcribeAudio, type TranscribeSegment } from "@/lib/api";
import { LANGUAGES } from "@/components/LanguageSelector";
import type { OutputMode } from "@/components/OutputModeSelector";

export type ServerModelSize = "tiny" | "base" | "small";

export type ServerTranscribeResult = {
  text: string;
  segments: TranscribeSegment[];
  language: string;
  modelId: ServerModelSize;
  duration: number;
};

const MODELS: { value: ServerModelSize; label: string; hint: string }[] = [
  { value: "tiny", label: "Tiny", hint: "Cepat · akurasi rendah" },
  { value: "base", label: "Base", hint: "Seimbang (rekomendasi)" },
  { value: "small", label: "Small", hint: "Akurat · lebih berat" },
];

type Stage =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing" }
  | { kind: "transcribing" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function ServerTranscriber({
  file,
  fileName,
  language,
  outputMode,
  onResult,
  disabled,
}: {
  file: Blob | null;
  fileName?: string;
  language: string;
  outputMode: OutputMode;
  onResult: (r: ServerTranscribeResult) => void;
  disabled?: boolean;
}) {
  const [modelSize, setModelSize] = useState<ServerModelSize>("base");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const busy =
    stage.kind === "uploading" ||
    stage.kind === "processing" ||
    stage.kind === "transcribing";

  const statusLabel = useMemo(() => {
    switch (stage.kind) {
      case "uploading":
        return "Mengunggah audio ke server…";
      case "processing":
        return "Server memproses audio (konversi ffmpeg)…";
      case "transcribing":
        return "Transkripsi berjalan di server…";
      case "done":
        return "Selesai.";
      case "error":
        return stage.message;
      default:
        return null;
    }
  }, [stage]);

  async function run() {
    if (!file) {
      toast.error("Belum ada file audio.");
      return;
    }

    const langOpt = LANGUAGES.find((l) => l.value === language);
    const lang = langOpt?.value || "auto";
    const name = fileName || "audio.webm";

    setStage({ kind: "uploading" });

    // Pindah ke "processing" setelah jeda kecil agar UI memberi feedback
    // walau backend masih sync (tanpa SSE).
    const processingTimer = setTimeout(
      () => setStage({ kind: "processing" }),
      800
    );
    const transcribingTimer = setTimeout(
      () => setStage({ kind: "transcribing" }),
      2500
    );

    try {
      const res = await transcribeAudio(file, name, {
        language: lang,
        modelSize,
        outputMode,
      });
      clearTimeout(processingTimer);
      clearTimeout(transcribingTimer);

      setStage({ kind: "done" });
      onResult({
        text: res.text,
        segments: res.segments,
        language: res.language,
        modelId: modelSize,
        duration: res.duration,
      });
      toast.success("Transkripsi selesai");
    } catch (e: any) {
      clearTimeout(processingTimer);
      clearTimeout(transcribingTimer);
      const msg = e?.message || "Transkripsi gagal.";
      setStage({ kind: "error", message: msg });
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Server className="h-3.5 w-3.5" /> Server-side · faster-whisper
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Model Whisper
            </Label>
            <Select
              value={modelSize}
              onValueChange={(v) => setModelSize(v as ServerModelSize)}
              disabled={busy || disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="font-medium">{m.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {m.hint}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={run}
              disabled={busy || disabled || !file}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy ? "Memproses…" : "Transkripsi via Server"}
            </Button>
          </div>
        </div>

        {statusLabel && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-md border p-2 text-xs ${
              stage.kind === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{statusLabel}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          <Badge variant="outline">
            <Cpu className="mr-1 h-3 w-3" /> {modelSize}
          </Badge>
          <Badge variant="outline">Open-source · self-hosted</Badge>
        </div>
      </div>
    </div>
  );
}
