import { createServerFn } from "@tanstack/react-start";

const ADMIN_ROLL = "224";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const hashPw = (pw: string, roll: string) => sha256(pw.trim() + ":" + roll.trim());

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function verifyAdmin(adminToken: string): Promise<boolean> {
  if (!adminToken) return false;
  const sb = await getAdmin();
  const { data } = await sb.from("student_credentials").select("password_hash").eq("college_roll", ADMIN_ROLL).maybeSingle();
  return !!data && data.password_hash === adminToken.trim();
}

export const lookupStudent = createServerFn({ method: "POST" })
  .inputValidator((d: { roll: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const roll = data.roll.trim();
    const { data: s } = await sb.from("students").select("college_roll, uni_roll, name, short_name").eq("college_roll", roll).maybeSingle();
    if (!s) return { found: false as const };
    const { data: c } = await sb.from("student_credentials").select("college_roll").eq("college_roll", roll).maybeSingle();
    return {
      found: true as const,
      college_roll: s.college_roll,
      name: s.name,
      short_name: s.short_name,
      has_password: !!c,
      is_admin: s.college_roll === ADMIN_ROLL,
    };
  });

export const verifyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { roll: string; password: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const roll = data.roll.trim();
    const { data: c } = await sb.from("student_credentials").select("password_hash").eq("college_roll", roll).maybeSingle();
    if (!c) return { ok: false as const };
    const h = await hashPw(data.password, roll);
    if (h !== c.password_hash) return { ok: false as const };
    const { data: s } = await sb.from("students").select("college_roll, name, short_name").eq("college_roll", roll).maybeSingle();
    return { ok: true as const, student: s, adminToken: roll === ADMIN_ROLL ? h : null };
  });

export const createPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { roll: string; uniRoll: string; password: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const roll = data.roll.trim();
    const { data: s } = await sb.from("students").select("uni_roll, college_roll, name, short_name").eq("college_roll", roll).maybeSingle();
    if (!s) return { ok: false as const, error: "Not found" };
    if (s.uni_roll !== data.uniRoll.trim()) return { ok: false as const, error: "University roll does not match" };
    if (data.password.length < 4) return { ok: false as const, error: "Password too short" };
    const h = await hashPw(data.password, roll);
    await sb.from("student_credentials").upsert({ college_roll: roll, password_hash: h, updated_at: new Date().toISOString() });
    return {
      ok: true as const,
      student: { college_roll: s.college_roll, name: s.name, short_name: s.short_name },
      adminToken: roll === ADMIN_ROLL ? h : null,
    };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((d: { roll: string; oldPassword: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const roll = data.roll.trim();
    if (data.newPassword.length < 4) return { ok: false as const, error: "Password too short" };
    const { data: c } = await sb.from("student_credentials").select("password_hash").eq("college_roll", roll).maybeSingle();
    if (c?.password_hash) {
      const oldH = await hashPw(data.oldPassword, roll);
      if (oldH !== c.password_hash) return { ok: false as const, error: "Current password is incorrect" };
    }
    const newH = await hashPw(data.newPassword, roll);
    await sb.from("student_credentials").upsert({ college_roll: roll, password_hash: newH, updated_at: new Date().toISOString() });
    return { ok: true as const };
  });

export const adminListStudents = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.adminToken))) throw new Error("Unauthorized");
    const sb = await getAdmin();
    const { data: students } = await sb.from("students").select("college_roll, uni_roll, name, short_name, avatar_url, created_at").order("college_roll");
    const { data: creds } = await sb.from("student_credentials").select("college_roll");
    const credSet = new Set((creds || []).map((c) => c.college_roll));
    return (students || []).map((s) => ({ ...s, has_password: credSet.has(s.college_roll) }));
  });

export const adminResetStudent = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string; roll: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.adminToken))) throw new Error("Unauthorized");
    if (data.roll.trim() === ADMIN_ROLL) return { ok: false as const, error: "Cannot reset admin" };
    const sb = await getAdmin();
    await sb.from("student_credentials").delete().eq("college_roll", data.roll.trim());
    return { ok: true as const };
  });

export const adminAddStudent = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string; college_roll: string; uni_roll: string; name: string; short_name: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.adminToken))) throw new Error("Unauthorized");
    const sb = await getAdmin();
    const roll = data.college_roll.trim();
    if (!roll || !data.uni_roll.trim() || !data.name.trim()) return { ok: false as const, error: "Missing required fields" };
    const short = data.short_name.trim() || data.name.trim().split(" ")[0];
    const { error } = await sb.from("students").insert({
      college_roll: roll, uni_roll: data.uni_roll.trim(), name: data.name.trim(), short_name: short,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const adminRemoveStudent = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string; roll: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.adminToken))) throw new Error("Unauthorized");
    if (data.roll.trim() === ADMIN_ROLL) return { ok: false as const, error: "Cannot remove admin" };
    const sb = await getAdmin();
    const roll = data.roll.trim();
    await sb.from("student_credentials").delete().eq("college_roll", roll);
    await sb.from("students").delete().eq("college_roll", roll);
    return { ok: true as const };
  });

export const adminSetWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string; whatsapp: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.adminToken))) throw new Error("Unauthorized");
    const sb = await getAdmin();
    const number = data.whatsapp.trim();
    if (!number) return { ok: false as const, error: "Number required" };
    const { data: existing } = await sb.from("settings").select("id").eq("key", "admin_whatsapp").maybeSingle();
    if (existing) {
      await sb.from("settings").update({ value: number, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await sb.from("settings").insert({ key: "admin_whatsapp", value: number });
    }
    return { ok: true as const };
  });

export const updateAvatar = createServerFn({ method: "POST" })
  .inputValidator((d: { roll: string; avatarUrl: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    await sb.from("students").update({ avatar_url: data.avatarUrl, updated_at: new Date().toISOString() }).eq("college_roll", data.roll.trim());
    return { ok: true as const };
  });

export const updateShortName = createServerFn({ method: "POST" })
  .inputValidator((d: { roll: string; shortName: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const short = data.shortName.trim();
    if (!short) return { ok: false as const, error: "Nickname cannot be empty" };
    if (short.length > 40) return { ok: false as const, error: "Too long" };
    await sb.from("students").update({ short_name: short, updated_at: new Date().toISOString() }).eq("college_roll", data.roll.trim());
    return { ok: true as const, short_name: short };
  });