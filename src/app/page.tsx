"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Upload,
  Sparkles,
  Languages,
  Cpu,
  ShieldCheck,
  Radio,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { AudioRecorder, type RecordingResult } from "@/components/AudioRecorder";
import { AudioUploader, type UploadedAudio } from "@/components/AudioUploader";
import { RealtimeSpeech } from "@/components/RealtimeSpeech";
import { LocalWhisperTranscriber } from "@/components/LocalWhisperTranscriber";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  OutputModeSelector,
  type OutputMode,
} from "@/components/OutputModeSelector";
import {
  TranscriptResult,
  type TranscriptData,
} from "@/components/TranscriptResult";
import {
  TranscriptHistory,
  upsertHistoryItem,
} from "@/components/TranscriptHistory";
import { BrowserSupportWarning } from "@/components/BrowserSupportWarning";

type Tab = "realtime" | "upload" | "record";

function makeId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("realtime");

  const [language, setLanguage] = useState("auto");
  const [outputMode, setOutputMode] = useState<OutputMode>("plain");

  const [recording, setRecording] = useState<RecordingResult | null>(null);
  const [upload, setUpload] = useState<UploadedAudio | null>(null);

  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const localFile: Blob | null = useMemo(() => {
    if (tab === "upload") return upload?.file ?? null;
    if (tab === "record") return recording?.blob ?? null;
    return null;
  }, [tab, upload, recording]);

  function handleRealtimeCommit(text: string) {
    const data: TranscriptData = {
      id: makeId(),
      title: `Realtime ${new Date().toLocaleString()}`,
      text,
      language,
      outputMode,
      source: "realtime",
      createdAt: Date.now(),
    };
    setTranscript(data);
  }

  function handleWhisperResult(r: { text: string; language: string; modelId: string }) {
    const sourceFile =
      tab === "upload" ? upload?.file?.name : recording?.fileName;
    const data: TranscriptData = {
      id: makeId(),
      title: sourceFile ? sourceFile.replace(/\.[^.]+$/, "") : `Whisper ${new Date().toLocaleString()}`,
      text: r.text,
      language: r.language || language,
      outputMode,
      source: "local-whisper",
      modelId: r.modelId,
      fileName: sourceFile,
      durationSec:
        tab === "upload" ? upload?.durationSec : recording?.durationSec,
      fileSize: tab === "upload" ? upload?.size : recording?.size,
      createdAt: Date.now(),
    };
    setTranscript(data);
  }

  function saveToHistory(d: TranscriptData) {
    upsertHistoryItem(d);
    setHistoryKey((k) => k + 1);
  }

  function clearAll() {
    setTranscript(null);
  }

  return (
    <>
      {/* HERO */}
      <section className="hero-bg relative overflow-hidden">
        <div className="container py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge variant="default" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" /> 100% Gratis · Tanpa API berbayar
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Transkripin —{" "}
              <span className="gradient-text">Ubah Suara Jadi Teks Gratis</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Rekam suara, upload audio, dan dapatkan teks transkripsi langsung dari
              browser tanpa API berbayar. Web Speech API untuk realtime, Whisper lokal
              (Transformers.js) untuk file audio.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                <Languages className="mr-1 h-3 w-3" /> 6 bahasa
              </Badge>
              <Badge variant="outline">
                <Radio className="mr-1 h-3 w-3" /> Realtime browser
              </Badge>
              <Badge variant="outline">
                <Cpu className="mr-1 h-3 w-3" /> Whisper lokal
              </Badge>
              <Badge variant="outline">
                <ShieldCheck className="mr-1 h-3 w-3" /> Privasi: audio diproses di browser
              </Badge>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WORKSPACE */}
      <section className="container pb-16">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* LEFT: input + result */}
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" /> Audio Input
                </CardTitle>
                <CardDescription>
                  Pilih cara transkripsi: realtime via Web Speech API, atau upload/rekam
                  audio dan proses dengan Whisper lokal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <LanguageSelector value={language} onChange={setLanguage} />
                  <OutputModeSelector value={outputMode} onChange={setOutputMode} />
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="realtime">
                      <Radio className="h-4 w-4" /> Realtime
                    </TabsTrigger>
                    <TabsTrigger value="upload">
                      <Upload className="h-4 w-4" /> Upload Audio
                    </TabsTrigger>
                    <TabsTrigger value="record">
                      <Mic className="h-4 w-4" /> Rekam + Whisper
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="realtime" className="pt-4">
                    <RealtimeSpeech
                      language={language}
                      onCommit={handleRealtimeCommit}
                    />
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-4 pt-4">
                    <BrowserSupportWarning
                      tone="info"
                      message="Audio Anda diproses langsung di browser. Untuk file panjang (>10 menit) atau perangkat lemah, pertimbangkan whisper.cpp self-hosted (lihat README)."
                    />
                    <AudioUploader onSelected={setUpload} />
                    <LocalWhisperTranscriber
                      file={localFile}
                      language={language}
                      outputMode={outputMode}
                      onResult={handleWhisperResult}
                    />
                  </TabsContent>

                  <TabsContent value="record" className="space-y-4 pt-4">
                    <AudioRecorder onReady={setRecording} />
                    <LocalWhisperTranscriber
                      file={localFile}
                      language={language}
                      outputMode={outputMode}
                      onResult={handleWhisperResult}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TranscriptResult
                  data={transcript}
                  onChange={setTranscript}
                  onClear={clearAll}
                  onSaveToHistory={saveToHistory}
                />
              </motion.div>
            )}
          </div>

          {/* RIGHT: history */}
          <aside>
            <TranscriptHistory
              refreshKey={historyKey}
              onPick={(it) => setTranscript(it)}
            />
          </aside>
        </div>
      </section>
    </>
  );
}
