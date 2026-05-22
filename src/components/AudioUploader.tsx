"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileAudio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_AUDIO_EXT,
  MAX_FILE_SIZE,
  formatBytes,
  formatDuration,
} from "@/lib/utils";
import { BrowserSupportWarning } from "@/components/BrowserSupportWarning";

export type UploadedAudio = {
  file: File;
  url: string;
  durationSec: number;
  size: number;
};

export function AudioUploader({
  onSelected,
  disabled,
}: {
  onSelected: (a: UploadedAudio | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<UploadedAudio | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    setError(null);
    if (!files || !files[0]) return;
    const file = files[0];
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ACCEPTED_AUDIO_EXT.includes(ext)) {
      setError(`Format tidak didukung. Gunakan: ${ACCEPTED_AUDIO_EXT.join(", ")}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `Ukuran maksimal 100MB (file Anda ${formatBytes(file.size)}).`
      );
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      const u: UploadedAudio = {
        file,
        url,
        durationSec: isFinite(audio.duration) ? audio.duration : 0,
        size: file.size,
      };
      setItem(u);
      onSelected(u);
    };
    audio.onerror = () => {
      const u: UploadedAudio = { file, url, durationSec: 0, size: file.size };
      setItem(u);
      onSelected(u);
    };
  }

  function clear() {
    if (item?.url) URL.revokeObjectURL(item.url);
    setItem(null);
    onSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:bg-muted/50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">Klik atau seret file ke sini</p>
        <p className="text-xs text-muted-foreground">
          MP3, WAV, M4A, WEBM, OGG, FLAC, MP4 · maks 100MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_AUDIO_EXT.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <BrowserSupportWarning message={error} tone="error" />}

      {item && (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileAudio className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{item.file.name}</p>
                <p className="text-muted-foreground">
                  {item.durationSec ? formatDuration(item.durationSec) + " · " : ""}
                  {formatBytes(item.size)}
                </p>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={clear} aria-label="Hapus">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <audio src={item.url} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
