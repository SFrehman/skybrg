import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resetPasskey } from "@/lib/passkey.functions";

export function PasskeyReset() {
  const [open, setOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [newPasskey, setNewPasskey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const fnReset = useServerFn(resetPasskey);

  const handleOpen = () => {
    setOpen(true);
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

  const handleReset = async () => {
    const trimmedPasskey = newPasskey.trim();

    if (!trimmedPasskey || !resetPassword.trim()) {
      setError("Enter the reset password and a new passkey");
      return;
    }

    setSaving(true);
    try {
      const res = await fnReset({ data: { resetPassword: resetPassword.trim(), newPasskey: trimmedPasskey } });
      if (!res.ok) {
        setError(res.error || "Could not update passkey");
        setSaving(false);
        return;
      }
    } catch {
      setError("Could not update passkey");
      setSaving(false);
      return;
    }

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
              Reset Passkey
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reset Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter reset password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
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
            </div>
            <div className="space-y-2">
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
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-500">{success}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => void handleReset()} disabled={!newPasskey.trim() || !resetPassword.trim() || saving}>
              {saving ? "Saving..." : "Save Passkey"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
