import { createServerFn } from "@tanstack/react-start";

const PASSKEY_SETTING_KEY = "upload_passkey";
const DEFAULT_PASSKEY = "Saif_Jani";
const RESET_PASSWORD = "5683";

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

export const resetPasskey = createServerFn({ method: "POST" })
  .inputValidator((d: { resetPassword: string; newPasskey: string }) => {
    const resetPassword = typeof d?.resetPassword === "string" ? d.resetPassword.trim() : "";
    const newPasskey = typeof d?.newPasskey === "string" ? d.newPasskey.trim() : "";
    if (!resetPassword || !newPasskey || newPasskey.length > 200) throw new Error("Invalid input");
    return { resetPassword, newPasskey };
  })
  .handler(async ({ data }) => {
    if (data.resetPassword !== RESET_PASSWORD) {
      return { ok: false as const, error: "Invalid reset password" };
    }
    const sb = await getAdmin();
    const { error } = await sb
      .from("settings")
      .upsert(
        { key: PASSKEY_SETTING_KEY, value: data.newPasskey, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) return { ok: false as const, error: "Failed to save passkey" };
    return { ok: true as const };
  });
