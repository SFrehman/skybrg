import { supabase } from "@/integrations/supabase/client";

const PASSKEY_SETTING_KEY = "upload_passkey";
const DEFAULT_PASSKEY = "Saif_Jani";

let cachedPasskey = DEFAULT_PASSKEY;
let loadingPromise: Promise<string> | null = null;
let syncStarted = false;

async function fetchPasskeyFromDb(): Promise<string> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", PASSKEY_SETTING_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.value?.trim() || DEFAULT_PASSKEY;
}

export async function refreshPasskey(): Promise<string> {
  if (!loadingPromise) {
    loadingPromise = fetchPasskeyFromDb()
      .then((value) => {
        cachedPasskey = value;
        return value;
      })
      .catch(() => cachedPasskey)
      .finally(() => {
        loadingPromise = null;
      });
  }

  return loadingPromise;
}

export function setPasskey(passkey: string) {
  cachedPasskey = passkey.trim() || DEFAULT_PASSKEY;
}

export async function validatePasskey(input: string): Promise<boolean> {
  const latestPasskey = await refreshPasskey();
  return input.trim() === latestPasskey;
}

export function startPasskeySync() {
  if (typeof window === "undefined" || syncStarted) {
    return;
  }

  syncStarted = true;
  void refreshPasskey();

  supabase
    .channel("upload-passkey-sync")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "settings",
        filter: `key=eq.${PASSKEY_SETTING_KEY}`,
      },
      () => {
        void refreshPasskey();
      }
    )
    .subscribe();
}

if (typeof window !== "undefined") {
  startPasskeySync();
}