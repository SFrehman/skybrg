import { createServerFn } from "@tanstack/react-start";

const BUCKET = "user-files";
const MAX_ROWS = 100;
const MAX_NAME = 300;
const MAX_TEXT = 200_000;
const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readPasskey(): Promise<string> {
  const sb = await getAdmin();
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", "upload_passkey")
    .maybeSingle();
  return data?.value?.trim() || "Saif_Jani";
}

interface FileRowInput {
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: number;
  storage_path: string | null;
  text_content?: string | null;
}

function validateRows(input: unknown): FileRowInput[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ROWS) {
    throw new Error("Invalid file list");
  }
  return input.map((r) => {
    const row = r as Partial<FileRowInput>;
    const file_name = typeof row.file_name === "string" ? row.file_name.trim() : "";
    const display_name = typeof row.display_name === "string" ? row.display_name.trim() : "";
    const file_type = typeof row.file_type === "string" ? row.file_type.trim() : "";
    const file_size = typeof row.file_size === "number" ? row.file_size : -1;
    const storage_path = typeof row.storage_path === "string" ? row.storage_path : null;
    const text_content = typeof row.text_content === "string" ? row.text_content : null;
    if (!file_name || file_name.length > MAX_NAME) throw new Error("Invalid file name");
    if (!display_name || display_name.length > MAX_NAME) throw new Error("Invalid display name");
    if (!file_type || file_type.length > 120) throw new Error("Invalid file type");
    if (file_size < 0 || file_size > MAX_SIZE) throw new Error("Invalid file size");
    if (storage_path && (storage_path.length > 500 || !storage_path.startsWith("uploads/"))) {
      throw new Error("Invalid storage path");
    }
    if (text_content !== null && text_content.length > MAX_TEXT) throw new Error("Text too long");
    if (text_content === null && !storage_path) throw new Error("Missing storage path");
    return { file_name, display_name, file_type, file_size, storage_path, text_content };
  });
}

// Creates short-lived signed upload URLs so clients can upload without any
// public write policy on the storage bucket.
export const createUploadUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { paths: string[] }) => {
    if (!Array.isArray(d?.paths) || d.paths.length === 0 || d.paths.length > MAX_ROWS) {
      throw new Error("Invalid paths");
    }
    const paths = d.paths.map((p) => {
      if (typeof p !== "string" || p.length > 500 || !p.startsWith("uploads/") || p.includes("..")) {
        throw new Error("Invalid path");
      }
      return p;
    });
    return { paths };
  })
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const out: Array<{ path: string; signedUrl: string }> = [];
    for (const path of data.paths) {
      const { data: signed, error } = await sb.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (error || !signed) throw new Error(error?.message || "Could not create upload URL");
      out.push({ path, signedUrl: signed.signedUrl });
    }
    return { uploads: out };
  });

// Registers file metadata rows after the bytes are uploaded.
export const registerFiles = createServerFn({ method: "POST" })
  .inputValidator((d: { rows: unknown }) => ({ rows: validateRows(d?.rows) }))
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const { error } = await sb.from("files").insert(data.rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Deletes files only after verifying the passkey server-side.
export const deleteFiles = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: string[]; passkey: string }) => {
    const ids = Array.isArray(d?.ids) ? d.ids.filter((x) => typeof x === "string") : [];
    const passkey = typeof d?.passkey === "string" ? d.passkey.trim() : "";
    if (ids.length === 0 || ids.length > MAX_ROWS) throw new Error("Invalid selection");
    if (!passkey || passkey.length > 200) throw new Error("Passkey required");
    return { ids, passkey };
  })
  .handler(async ({ data }) => {
    const current = await readPasskey();
    if (data.passkey !== current) throw new Error("Invalid passkey");
    const sb = await getAdmin();
    const { data: rows, error: fetchErr } = await sb
      .from("files")
      .select("id, storage_path")
      .in("id", data.ids);
    if (fetchErr) throw new Error(fetchErr.message);
    const paths = (rows ?? [])
      .map((r) => r.storage_path)
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      await sb.storage.from(BUCKET).remove(paths);
    }
    const { error } = await sb.from("files").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
