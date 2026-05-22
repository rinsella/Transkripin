/// <reference lib="webworker" />
/**
 * Dedicated Web Worker that runs Whisper via @xenova/transformers entirely in
 * the browser (no server, no API key, no onnxruntime-node).
 *
 * Protocol — messages from UI:
 *   { type: "transcribe", pcm: Float32Array, sampleRate: number,
 *     model: string, language: string | null, returnTimestamps: boolean }
 *
 * Messages from worker:
 *   { type: "progress", status, message, progress?, file? }
 *   { type: "result", text, chunks }
 *   { type: "error", message }
 */

type InMsg = {
  type: "transcribe";
  pcm: Float32Array;
  sampleRate: number;
  model: string;
  language: string | null;
  returnTimestamps: boolean;
};

type ProgressStatus =
  | "loading_model"
  | "downloading"
  | "decoding"
  | "transcribing"
  | "chunk"
  | "done"
  | "error";

type OutMsg =
  | {
      type: "progress";
      status: ProgressStatus;
      message?: string;
      progress?: number;
      file?: string;
      chunkIndex?: number;
      chunkTotal?: number;
    }
  | { type: "result"; text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }
  | { type: "error"; message: string };

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

function send(msg: OutMsg) {
  ctx.postMessage(msg);
}

// Cache transcriber per model id to avoid re-loading between requests.
const pipelineCache: Record<string, any> = {};

async function getTranscriber(modelId: string) {
  if (pipelineCache[modelId]) return pipelineCache[modelId];

  // Dynamic import so this huge bundle only loads when the worker is used.
  const tf: any = await import("@xenova/transformers");
  tf.env.allowLocalModels = false;
  if ("useBrowserCache" in tf.env) tf.env.useBrowserCache = true;
  // Force the WASM (browser) backend for ONNX. We never want the Node backend.
  if (tf.env.backends?.onnx?.wasm) {
    tf.env.backends.onnx.wasm.numThreads = 1;
  }

  const pipe = await tf.pipeline("automatic-speech-recognition", modelId, {
    quantized: true,
    progress_callback: (p: any) => {
      if (p.status === "progress") {
        send({
          type: "progress",
          status: "downloading",
          file: p.file,
          progress: Math.round(p.progress ?? 0),
          message: "Mengunduh model AI (sekali, lalu dicache di browser).",
        });
      } else if (p.status === "download") {
        send({
          type: "progress",
          status: "downloading",
          file: p.file,
          message: "Mulai mengunduh model AI…",
        });
      } else if (p.status === "initiate" || p.status === "loading") {
        send({
          type: "progress",
          status: "loading_model",
          file: p.file,
          message: "Memuat model ke memori…",
        });
      } else if (p.status === "ready") {
        send({
          type: "progress",
          status: "loading_model",
          message: "Model siap.",
        });
      }
    },
  });
  pipelineCache[modelId] = pipe;
  return pipe;
}

function formatTimestamp(t: number | null | undefined): string {
  if (t == null || !isFinite(t)) return "??:??";
  const s = Math.max(0, Math.floor(t));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

ctx.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (!msg || msg.type !== "transcribe") return;

  const { pcm, model, language, returnTimestamps } = msg;

  try {
    send({
      type: "progress",
      status: "loading_model",
      message: "Menyiapkan model…",
    });
    const pipe = await getTranscriber(model);

    const isEnglishOnly = model.endsWith(".en");
    const opts: Record<string, unknown> = {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: returnTimestamps,
    };
    if (!isEnglishOnly) {
      opts.task = "transcribe";
      if (language) opts.language = language;
    }

    // Whisper's pipeline handles chunking internally. We still surface a
    // "chunk N of M" estimate based on audio length / 30s so the UI feels
    // responsive on long files.
    const estChunks = Math.max(1, Math.ceil(pcm.length / 16000 / 30));
    send({
      type: "progress",
      status: "transcribing",
      message: `Mentranskripsi ~${estChunks} segmen…`,
      chunkIndex: 0,
      chunkTotal: estChunks,
    });

    const out: any = await pipe(pcm, opts);
    const text: string = (out?.text ?? "").trim();
    const chunks = Array.isArray(out?.chunks)
      ? out.chunks.map((c: any) => ({
          text: String(c.text ?? "").trim(),
          timestamp: c.timestamp as [number, number | null],
        }))
      : undefined;

    send({ type: "progress", status: "done", message: "Selesai." });
    send({ type: "result", text, chunks });
  } catch (err: any) {
    console.error("[transcribe.worker]", err);
    send({
      type: "error",
      message: err?.message ?? "Transkripsi gagal di worker.",
    });
  }
};

// Helper accessor so consumers can format timestamps the same way.
export const __formatTimestamp = formatTimestamp;
export {};
