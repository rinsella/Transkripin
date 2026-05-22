"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Pause, Play, Square, Trash2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob, formatDuration } from "@/lib/utils";
import { LANGUAGES } from "@/components/LanguageSelector";
import { BrowserSupportWarning } from "@/components/BrowserSupportWarning";

type RecState = "idle" | "listening" | "paused" | "stopped" | "error";

type SR = any; // SpeechRecognition (vendor-prefixed)

export function RealtimeSpeech({
  language,
  onCommit,
}: {
  /** Generic language code, e.g. "id", "en", "auto" */
  language: string;
  /** Called when user commits the final transcript (used to push to history/result) */
  onCommit?: (text: string) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SR | null>(null);
  const timerRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);

  const locale = useMemo(() => {
    const l = LANGUAGES.find((x) => x.value === language);
    // For "auto", default to Indonesian since Web Speech needs a concrete locale.
    return l?.bcp47 ?? "id-ID";
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SRClass: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SRClass);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
    };
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

  function buildRecognition(): SR | null {
    if (typeof window === "undefined") return null;
    const SRClass: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) return null;

    const rec: SR = new SRClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = locale;

    rec.onresult = (event: any) => {
      let interimChunk = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) finalChunk += txt + " ";
        else interimChunk += txt;
      }
      if (finalChunk) {
        setFinalText((prev) => (prev ? prev + " " : "") + finalChunk.trim());
      }
      setInterim(interimChunk);
    };

    rec.onerror = (event: any) => {
      const code = event?.error ?? "unknown";
      const msg =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Izin microphone ditolak. Aktifkan izin di browser, lalu coba lagi."
          : code === "no-speech"
          ? "Tidak ada suara terdeteksi. Coba bicara lebih dekat ke mic."
          : code === "audio-capture"
          ? "Microphone tidak ditemukan."
          : code === "network"
          ? "Web Speech API butuh koneksi internet untuk beberapa browser."
          : `Terjadi error: ${code}`;
      setError(msg);
      setState("error");
      stopTimer();
    };

    rec.onend = () => {
      // Auto-restart while user expects continuous capture.
      if (!manualStopRef.current && (state === "listening")) {
        try {
          rec.start();
        } catch {
          /* sometimes it's already started */
        }
      }
    };

    return rec;
  }

  function handleStart() {
    setError(null);
    const rec = buildRecognition();
    if (!rec) {
      setError(
        "Browser Anda tidak mendukung Web Speech API. Coba Google Chrome / Edge versi terbaru di desktop."
      );
      setState("error");
      return;
    }
    recognitionRef.current = rec;
    manualStopRef.current = false;
    try {
      rec.start();
      setFinalText("");
      setInterim("");
      setElapsed(0);
      setState("listening");
      startTimer();
    } catch (e: any) {
      setError(e?.message ?? "Gagal memulai pengenalan suara.");
      setState("error");
    }
  }

  function handlePause() {
    manualStopRef.current = true;
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    stopTimer();
    setState("paused");
  }
  function handleResume() {
    handleStart();
  }
  function handleStop() {
    manualStopRef.current = true;
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    stopTimer();
    setState("stopped");
  }
  function handleClear() {
    setFinalText("");
    setInterim("");
    setElapsed(0);
    setError(null);
    setState("idle");
  }

  async function copy() {
    const text = (finalText + " " + interim).trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("Disalin ke clipboard");
  }

  function download() {
    const text = (finalText + " " + interim).trim();
    if (!text) return;
    downloadBlob(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `transkripin-realtime-${Date.now()}.txt`
    );
  }

  function commit() {
    const text = (finalText + " " + interim).trim();
    if (!text) return;
    onCommit?.(text);
    toast.success("Hasil dikirim ke panel transkripsi");
  }

  if (supported === false) {
    return (
      <BrowserSupportWarning
        tone="error"
        message="Browser ini tidak mendukung Web Speech API. Mohon gunakan Google Chrome atau Microsoft Edge versi terbaru (desktop disarankan). Anda tetap bisa memakai tab 'Upload Audio' untuk transkripsi lokal."
      />
    );
  }

  return (
    <div className="space-y-4">
      <BrowserSupportWarning
        tone="info"
        message="Mode realtime memakai Web Speech API browser. Kualitas & dukungan bahasa tergantung browser. Beberapa browser mengirim audio ke layanan vendor (Chrome → Google) untuk diproses — gratis, tanpa API key dari Anda."
      />

      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {state === "listening" && (
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulseRing" />
          )}
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${
              state === "listening"
                ? "bg-red-500 text-white"
                : state === "paused"
                ? "bg-amber-500 text-white"
                : state === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Mic className="h-9 w-9" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={
              state === "listening"
                ? "destructive"
                : state === "paused"
                ? "warning"
                : state === "error"
                ? "destructive"
                : "outline"
            }
          >
            {state === "listening" && "● Listening"}
            {state === "paused" && "❚❚ Paused"}
            {state === "stopped" && "■ Stopped"}
            {state === "error" && "Error"}
            {state === "idle" && "Idle"}
          </Badge>
          <span className="font-mono text-2xl tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {locale}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {(state === "idle" || state === "error" || state === "stopped") && (
            <Button onClick={handleStart} size="lg">
              <Mic className="h-4 w-4" /> Start
            </Button>
          )}
          {state === "listening" && (
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
        </div>
      </div>

      {error && <BrowserSupportWarning message={error} tone="error" />}

      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Transkrip realtime
        </p>
        <div className="min-h-[140px] whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
          {finalText || <span className="text-muted-foreground">Belum ada teks…</span>}
          {interim && (
            <span className="text-muted-foreground italic"> {interim}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy} disabled={!finalText && !interim}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!finalText && !interim}>
            <Download className="h-4 w-4" /> Download TXT
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={!finalText && !interim && state === "idle"}>
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          {onCommit && (
            <Button size="sm" className="ml-auto" onClick={commit} disabled={!finalText && !interim}>
              Simpan ke Panel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
