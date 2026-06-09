import { toast } from "sonner";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per range
const CONCURRENCY = 6;
const PARALLEL_THRESHOLD = 12 * 1024 * 1024; // only bother >12MB

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

async function streamToBlob(
  res: Response,
  onChunk: (n: number) => void,
): Promise<Blob> {
  const reader = res.body?.getReader();
  if (!reader) {
    const b = await res.blob();
    onChunk(b.size);
    return b;
  }
  const parts: BlobPart[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    onChunk(value.byteLength);
  }
  return new Blob(parts);
}

export async function downloadFileFast(url: string, fileName: string): Promise<void> {
  const toastId = toast.loading(`Downloading "${fileName}"…`, { description: "Starting…" });
  try {
    // Probe with a tiny range request — also gives us total size via Content-Range.
    const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
    if (!probe.ok && probe.status !== 206 && probe.status !== 200) {
      throw new Error(`HTTP ${probe.status}`);
    }
    let total = 0;
    let acceptRanges = false;
    const contentRange = probe.headers.get("content-range");
    if (probe.status === 206 && contentRange) {
      const m = /\/(\d+)$/.exec(contentRange);
      if (m) total = Number(m[1]);
      acceptRanges = true;
    } else {
      total = Number(probe.headers.get("content-length") || 0);
    }
    // Drain the probe body so the connection can be reused/closed.
    try { await probe.arrayBuffer(); } catch { /* ignore */ }

    let loaded = 0;
    const tick = (delta: number) => {
      loaded += delta;
      const pct = total ? Math.round((loaded / total) * 100) : 0;
      toast.loading(`Downloading "${fileName}"… ${pct}%`, {
        id: toastId,
        description: total ? `${mb(loaded)} / ${mb(total)} MB` : `${mb(loaded)} MB`,
      });
    };

    let blob: Blob;

    if (acceptRanges && total > PARALLEL_THRESHOLD) {
      // Parallel range download
      const ranges: Array<[number, number]> = [];
      for (let start = 0; start < total; start += CHUNK_SIZE) {
        ranges.push([start, Math.min(start + CHUNK_SIZE - 1, total - 1)]);
      }
      const chunks = new Array<Uint8Array>(ranges.length);
      let cursor = 0;
      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= ranges.length) return;
          const [s, e] = ranges[i];
          const res = await fetch(url, { headers: { Range: `bytes=${s}-${e}` } });
          if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
          const partBlob = await streamToBlob(res, tick);
          chunks[i] = new Uint8Array(await partBlob.arrayBuffer());
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ranges.length) }, worker));
      blob = new Blob(chunks as BlobPart[]);
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!total) total = Number(res.headers.get("content-length") || 0);
      blob = await streamToBlob(res, tick);
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    toast.success(`Downloaded "${fileName}"`, { id: toastId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Download failed";
    toast.error(`Download failed: ${msg}`, { id: toastId });
    // Fallback: open in a new tab so the browser handles it natively
    window.open(url, "_blank");
  }
}