"use client";

import { AlertCircle } from "lucide-react";

export function BrowserSupportWarning({
  message,
  tone = "warn",
}: {
  message: string;
  tone?: "warn" | "info" | "error";
}) {
  const color =
    tone === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "info"
      ? "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${color}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
