"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy,
  Download,
  Eraser,
  FileText,
  FileDown,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun } from "docx";

export type TranscriptData = {
  id: string;
  title: string;
  text: string;
  language: string;
  outputMode: string;
  source: "realtime" | "local-whisper";
  modelId?: string;
  fileName?: string;
  durationSec?: number;
  fileSize?: number;
  createdAt: number;
};

export function TranscriptResult({
  data,
  onChange,
  onClear,
  onSaveToHistory,
}: {
  data: TranscriptData;
  onChange: (d: TranscriptData) => void;
  onClear: () => void;
  onSaveToHistory: (d: TranscriptData) => void;
}) {
  const [title, setTitle] = useState(data.title);

  function commitTitle() {
    onChange({ ...data, title: title || "Untitled Transcript" });
  }

  async function copy() {
    if (!data.text) return;
    await navigator.clipboard.writeText(data.text);
    toast.success("Disalin ke clipboard");
  }

  function downloadTxt() {
    if (!data.text) return;
    const blob = new Blob([data.text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${baseName()}.txt`);
  }

  async function downloadDocx() {
    if (!data.text) return;
    const doc = new Document({
      sections: [
        {
          children: data.text.split("\n").map(
            (line) => new Paragraph({ children: [new TextRun(line)] })
          ),
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${baseName()}.docx`);
  }

  function baseName() {
    return (data.title || "transkrip").replace(/[^\w\d-_]+/g, "_");
  }

  function save() {
    const payload = { ...data, title: title || "Untitled Transcript" };
    onSaveToHistory(payload);
    toast.success("Tersimpan ke riwayat lokal");
  }

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Hasil Transkripsi
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1">
            <Badge variant="outline">{(data.language || "auto").toUpperCase()}</Badge>
            <Badge variant="secondary">{data.outputMode}</Badge>
            <Badge variant="outline">
              {data.source === "realtime" ? "Realtime · Web Speech" : "Lokal · Whisper"}
            </Badge>
            {data.modelId && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {data.modelId}
              </Badge>
            )}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Eraser className="h-4 w-4" /> Clear
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Judul
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            placeholder="Beri judul transkrip ini"
          />
        </div>

        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
          {data.text || "—"}
        </pre>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTxt}>
            <Download className="h-4 w-4" /> .txt
          </Button>
          <Button variant="outline" size="sm" onClick={downloadDocx}>
            <FileDown className="h-4 w-4" /> .docx
          </Button>
          <Button size="sm" className="ml-auto" onClick={save}>
            <Save className="h-4 w-4" /> Save to History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
