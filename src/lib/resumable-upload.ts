import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Files at or above this size go through the resumable/tus endpoint with
// parallel chunks instead of a single PUT.
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024; // 6 MB
const CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB (Supabase requirement)

export async function uploadFileFast(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
): Promise<void> {
  if (file.size < RESUMABLE_THRESHOLD) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    onProgress?.(file.size, file.size);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 500, 1500, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${SUPABASE_KEY}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: CHUNK_SIZE,
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => onProgress?.(bytesUploaded, bytesTotal),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}