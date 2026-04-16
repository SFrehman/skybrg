import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setPasskey } from "@/lib/passkey";

const RESET_PASSWORD = "5683";

export function PasskeyReset() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"verify" | "reset">("verify");
  const [resetPassword, setResetPassword] = useState("");
  const [newPasskey, setNewPasskey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    setStep("verify");
    setResetPassword("");
    setNewPasskey("");
    setError("");
    setSuccess("");
    setShowPassword(false);
    setShowPasskey(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleVerify = () => {
    if (resetPassword === RESET_PASSWORD) {
      setStep("reset");
      setError("");
    } else {
      setError("Invalid reset password");
    }
  };

  const handleReset = async () => {
    const trimmedPasskey = newPasskey.trim();

    if (!trimmedPasskey) {
      setError("Passkey cannot be empty");
      return;
    }

    setSaving(true);

    const { error: dbError } = await supabase
      .from("settings")
      .upsert(
        { key: "upload_passkey", value: trimmedPasskey, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (dbError) {
      setError("Failed to save passkey");
      setSaving(false);
      return;
    }

    setPasskey(trimmedPasskey);
    setSaving(false);
    setSuccess("Passkey updated successfully!");
    setError("");
    setTimeout(() => handleClose(), 1200);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
        <KeyRound className="h-4 w-4" /> Reset Passkey
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {step === "verify" ? "Verify Identity" : "Set New Passkey"}
            </DialogTitle>
          </DialogHeader>

          {step === "verify" ? (
            <div className="space-y-3">
              <Label>Reset Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter reset password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <Label>New Passkey</Label>
              <div className="relative">
                <Input
                  type={showPasskey ? "text" : "password"}
                  placeholder="Enter new passkey"
                  value={newPasskey}
                  onChange={(e) => setNewPasskey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReset()}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey(!showPasskey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-500">{success}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            {step === "verify" ? (
              <Button onClick={handleVerify}>Verify</Button>
            ) : (
              <Button onClick={handleReset} disabled={!newPasskey.trim() || saving}>
                {saving ? "Saving..." : "Save Passkey"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
