"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Languages } from "lucide-react";

export type LanguageOption = {
  value: string;       // generic code dipakai UI / Whisper
  whisper: string | null; // kode bahasa untuk Whisper (null = auto)
  bcp47: string;       // locale untuk Web Speech API
  label: string;
};

export const LANGUAGES: LanguageOption[] = [
  { value: "auto", whisper: null, bcp47: "id-ID", label: "Auto Detect" },
  { value: "id",   whisper: "indonesian", bcp47: "id-ID", label: "Indonesian" },
  { value: "en",   whisper: "english",    bcp47: "en-US", label: "English" },
  { value: "ja",   whisper: "japanese",   bcp47: "ja-JP", label: "Japanese" },
  { value: "ko",   whisper: "korean",     bcp47: "ko-KR", label: "Korean" },
  { value: "ar",   whisper: "arabic",     bcp47: "ar-SA", label: "Arabic" },
];

export function LanguageSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Languages className="h-3.5 w-3.5" /> Bahasa
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih bahasa" />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
