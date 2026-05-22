"use client";

import { Loader2, Cpu, Download } from "lucide-react";

export type ModelLoadStatus = {
  stage: "idle" | "downloading" | "loading" | "ready" | "transcribing" | "error";
  progress?: number;   // 0..100
  message?: string;
  file?: string;
};

export function LoadingModelStatus({ status }: { status: ModelLoadStatus }) {
  if (status.stage === "idle") return null;

  const isError = status.stage === "error";
  const isReady = status.stage === "ready";

  const Icon = isReady ? Cpu : status.stage === "downloading" ? Download : Loader2;

  return (
    <div
      className={`space-y-2 rounded-lg border p-3 text-sm ${
        isError
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : isReady
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${
            !isReady && !isError ? "animate-spin" : ""
          }`}
        />
        <span className="font-medium capitalize">{status.stage}</span>
        {status.file && (
          <span className="truncate text-xs text-muted-foreground">
            · {status.file}
          </span>
        )}
      </div>
      {status.message && (
        <p className="text-xs leading-relaxed opacity-80">{status.message}</p>
      )}
      {typeof status.progress === "number" && status.progress > 0 && status.progress < 100 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, status.progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
