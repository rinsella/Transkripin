/**
 * Decode any audio Blob (mp3 / wav / m4a / webm / ogg) to a mono Float32Array
 * sampled at 16 kHz — the format Whisper expects.
 *
 * Runs purely in the browser via Web Audio API.
 */
export async function decodeAudioToMono16k(blob: Blob): Promise<Float32Array> {
  if (typeof window === "undefined") {
    throw new Error("decodeAudioToMono16k hanya bisa dipanggil di browser.");
  }

  const AC: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) {
    throw new Error("Browser tidak mendukung Web Audio API.");
  }

  const arrayBuffer = await blob.arrayBuffer();

  const tmpCtx = new AC();
  let decoded: AudioBuffer;
  try {
    // Some implementations consume the buffer; clone first.
    decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    await tmpCtx.close();
    throw new Error(
      "Gagal men-decode file audio. Format mungkin tidak didukung browser ini."
    );
  }
  await tmpCtx.close();

  const targetRate = 16000;
  const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const off = new OfflineAudioContext(1, length, targetRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Cut a long PCM Float32Array into ~`chunkSeconds`-long pieces with a small
 * overlap so we don't cut a word in half. Used to provide a "Processing chunk
 * X of Y" UX for long files.
 */
export function chunkPcm(
  pcm: Float32Array,
  sampleRate = 16000,
  chunkSeconds = 30,
  overlapSeconds = 1
): { offsetSec: number; data: Float32Array }[] {
  const chunkLen = Math.floor(chunkSeconds * sampleRate);
  const overlap = Math.floor(overlapSeconds * sampleRate);
  if (pcm.length <= chunkLen) {
    return [{ offsetSec: 0, data: pcm }];
  }
  const chunks: { offsetSec: number; data: Float32Array }[] = [];
  let start = 0;
  while (start < pcm.length) {
    const end = Math.min(pcm.length, start + chunkLen);
    chunks.push({
      offsetSec: start / sampleRate,
      data: pcm.slice(start, end),
    });
    if (end >= pcm.length) break;
    start = end - overlap;
  }
  return chunks;
}
