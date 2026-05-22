"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Trash2, FileText, Eye, Copy } from "lucide-react";
import { toast } from "sonner";
import type { TranscriptData } from "@/components/TranscriptResult";

const STORAGE_KEY = "transkripin:history:v1";

export function loadHistory(): TranscriptData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: TranscriptData[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Gagal menyimpan riwayat:", e);
  }
}

export function upsertHistoryItem(item: TranscriptData): TranscriptData[] {
  const items = loadHistory();
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  saveHistory(items);
  return items;
}

export function TranscriptHistory({
  refreshKey,
  onPick,
}: {
  refreshKey: number;
  onPick: (item: TranscriptData) => void;
}) {
  const [items, setItems] = useState<TranscriptData[]>([]);

  const reload = useCallback(() => setItems(loadHistory()), []);
  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  function remove(id: string) {
    if (!confirm("Hapus transkrip ini?")) return;
    const next = items.filter((x) => x.id !== id);
    saveHistory(next);
    setItems(next);
    toast.success("Transkrip dihapus");
  }

  function clearAll() {
    if (!confirm("Hapus SEMUA riwayat?")) return;
    saveHistory([]);
    setItems([]);
    toast.success("Semua riwayat dihapus");
  }

  async function copyItem(it: TranscriptData) {
    await navigator.clipboard.writeText(it.text);
    toast.success("Disalin ke clipboard");
  }

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Riwayat
          </CardTitle>
          <CardDescription>Tersimpan di browser Anda (localStorage)</CardDescription>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <Trash2 className="h-4 w-4" /> Clear All
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada riwayat. Hasil yang Anda simpan akan muncul di sini.
          </p>
        ) : (
          <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
            {items.map((it) => (
              <div
                key={it.id}
                className="group rounded-lg border bg-card/60 p-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {it.title || "Untitled Transcript"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(it.createdAt).toLocaleString()}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {(it.language || "auto").toUpperCase()}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {it.outputMode}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {it.source === "realtime" ? "realtime" : "whisper"}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {it.text.slice(0, 180)}
                          {it.text.length > 180 ? "…" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Lihat"
                      onClick={() => onPick(it)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy"
                      onClick={() => copyItem(it)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Hapus"
                      onClick={() => remove(it.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
