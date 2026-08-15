import { checkPasskey } from "@/lib/passkey.functions";

// The passkey never leaves the server: validation happens in a server function
// against the service-role-only `settings` table.
export async function validatePasskey(input: string): Promise<boolean> {
  const passkey = input.trim();
  if (!passkey) return false;
  try {
    const res = await checkPasskey({ data: { passkey } });
    return res.ok;
  } catch {
    return false;
  }
}
