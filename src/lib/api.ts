// Client helper untuk memanggil backend Transkripin (FastAPI + faster-whisper).

export type TranscribeOptions = {
  language?: string; // "auto" | "id" | "en" | ...
  modelSize?: "tiny" | "base" | "small";
  outputMode?: "plain" | "paragraph" | "timestamped";
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type TranscribeSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscribeResponse = {
  success: true;
  text: string;
  segments: TranscribeSegment[];
  language: string;
  duration: number;
  model: string;
};

export type TranscribeError = {
  success: false;
  status: number;
  error: string;
};

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

export function getApiBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL?.replace(/\/+$/, "") ?? "";
  return url || "http://localhost:8000";
}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${getApiBaseUrl()}/health`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Kirim audio ke backend untuk ditranskripsi.
 * Throws Error pada kegagalan — pesan error sudah ramah pengguna.
 */
export async function transcribeAudio(
  file: Blob,
  filename: string,
  options: TranscribeOptions = {}
): Promise<TranscribeResponse> {
  const {
    language = "auto",
    modelSize = "base",
    outputMode = "plain",
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const form = new FormData();
  form.append("file", file, filename);
  if (language) form.append("language", language === "auto" ? "" : language);
  form.append("model_size", modelSize);
  form.append("output_mode", outputMode);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j?.detail || j?.error || detail;
      } catch {
        try {
          detail = (await res.text()) || detail;
        } catch {
          /* ignore */
        }
      }
      throw new Error(detail);
    }

    const json = (await res.json()) as TranscribeResponse;
    return json;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(
        "Permintaan dibatalkan atau melewati timeout. Coba file lebih pendek atau model lebih kecil."
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
  }
}
