"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

export type OutputMode = "plain" | "paragraph" | "timestamped";

export const OUTPUT_MODES: { value: OutputMode; label: string }[] = [
  { value: "plain", label: "Plain Text" },
  { value: "paragraph", label: "Clean Paragraph" },
  { value: "timestamped", label: "Timestamped Transcript" },
];

export function OutputModeSelector({
  value,
  onChange,
}: {
  value: OutputMode;
  onChange: (v: OutputMode) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Mode Output
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as OutputMode)}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih mode output" />
        </SelectTrigger>
        <SelectContent>
          {OUTPUT_MODES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
