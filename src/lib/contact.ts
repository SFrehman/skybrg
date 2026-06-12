import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_ADMIN_WHATSAPP = "03153857725";

let cached: string | null = null;
const listeners = new Set<(v: string) => void>();

function setCached(value: string) {
  cached = value;
  listeners.forEach((l) => l(value));
}

export async function fetchAdminWhatsapp(): Promise<string> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "admin_whatsapp")
    .maybeSingle();
  const value = data?.value?.trim() || DEFAULT_ADMIN_WHATSAPP;
  setCached(value);
  return value;
}

export function waLink(number: string): string {
  const digits = number.replace(/[^\d]/g, "");
  // If starts with 0, replace with country code 92 (Pakistan) for wa.me
  const normalized = digits.startsWith("0") ? "92" + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

export function useAdminWhatsapp(): string {
  const [value, setValue] = useState<string>(cached || DEFAULT_ADMIN_WHATSAPP);
  useEffect(() => {
    const listener = (v: string) => setValue(v);
    listeners.add(listener);
    if (!cached) void fetchAdminWhatsapp();
    else setValue(cached);
    const channel = supabase
      .channel("admin-whatsapp-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings", filter: "key=eq.admin_whatsapp" },
        () => { void fetchAdminWhatsapp(); }
      )
      .subscribe();
    return () => { listeners.delete(listener); supabase.removeChannel(channel); };
  }, []);
  return value;
}

export function setAdminWhatsappCache(value: string) {
  setCached(value);
}