import { toast } from "sonner";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per range
const CONCURRENCY = 6;

export async function downloadFileFast(url: string, fileName: string): Promise<void> {
  const toastId = toast.loading(`Preparing "${fileName}"…`);
  try {
    // HEAD to learn size + range support
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) throw new Error(`HTTP ${head.status}`);
    const total = Number(head.headers.get("content-length") || 0);
    const acceptRanges = (head.headers.get("accept-ranges") || "").toLowerCase().includes("bytes");

    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    const updateProgress = (loaded: number) => {
      const pct = total ? Math.round((loaded / total) * 100) : 0;
      toast.loading(`Downloading "${fileName}"… ${pct}%`, {
        id: toastId,
        description: total ? `${mb(loaded)} / ${mb(total)} MB` : `${mb(loaded)} MB`,
      });
    };

    let blob: Blob;

    if (acceptRanges && total > CHUNK_SIZE * 2) {
      // Parallel range download
      const ranges: Array<[number, number]> = [];
      for (let start = 0; start < total; start += CHUNK_SIZE) {
        ranges.push([start, Math.min(start + CHUNK_SIZE - 1, total - 1)]);
      }
      const chunks = new Array<Uint8Array>(ranges.length);
      const loadedPer = new Array<number>(ranges.length).fill(0);
      let cursor = 0;

      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= ranges.length) return;
          const [s, e] = ranges[i];
          const res = await fetch(url, { headers: { Range: `bytes=${s}-${e}` } });
          if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
          const reader = res.body?.getReader();
          if (!reader) {
            const buf = new Uint8Array(await res.arrayBuffer());
            chunks[i] = buf;
            loadedPer[i] = buf.byteLength;
            updateProgress(loadedPer.reduce((a, b) => a + b, 0));
            continue;
          }
          const parts: Uint8Array[] = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value);
            received += value.byteLength;
            loadedPer[i] = received;
            updateProgress(loadedPer.reduce((a, b) => a + b, 0));
          }
          const merged = new Uint8Array(received);
          let off = 0;
          for (const p of parts) { merged.set(p, off); off += p.byteLength; }
          chunks[i] = merged;
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ranges.length) }, worker));
      blob = new Blob(chunks as BlobPart[]);
    } else {
      // Streamed single download with progress
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) {
        blob = await res.blob();
        updateProgress(blob.size);
      } else {
        const parts: Uint8Array[] = [];
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          loaded += value.byteLength;
          updateProgress(loaded);
        }
        blob = new Blob(parts as BlobPart[]);
      }
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
    // Fallback to direct browser download
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}