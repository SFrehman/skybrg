import { createServerFn } from "@tanstack/react-start";

const PASSKEY_SETTING_KEY = "upload_passkey";
const DEFAULT_PASSKEY = "Saif_Jani";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readPasskey(): Promise<string> {
  const sb = await getAdmin();
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", PASSKEY_SETTING_KEY)
    .maybeSingle();
  return data?.value?.trim() || DEFAULT_PASSKEY;
}

export const checkPasskey = createServerFn({ method: "POST" })
  .inputValidator((d: { passkey: string }) => {
    const passkey = typeof d?.passkey === "string" ? d.passkey.trim() : "";
    if (!passkey || passkey.length > 200) throw new Error("Invalid passkey");
    return { passkey };
  })
  .handler(async ({ data }) => {
    const current = await readPasskey();
    return { ok: data.passkey === current };
  });
