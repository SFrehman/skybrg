import { createUploadUrls } from "@/lib/files.functions";

// Uploads go through short-lived signed upload URLs created by the server,
// because the storage bucket no longer allows direct public writes.
// Progress is reported via XHR upload events.
export async function uploadFileFast(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
): Promise<void> {
  const { uploads } = await createUploadUrls({ data: { paths: [path] } });
  const target = uploads.find((u) => u.path === path);
  if (!target) throw new Error("Could not create upload URL");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const signedUrl = target.signedUrl.startsWith("http")
    ? target.signedUrl
    : `${supabaseUrl}${target.signedUrl}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(file.size, file.size);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
