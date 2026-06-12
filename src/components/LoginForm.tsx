import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Eye, EyeOff, Loader2, ArrowLeft, MessageCircle } from "lucide-react";
import { lookupStudent, verifyPassword, createPassword } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { useAdminWhatsapp, waLink } from "@/lib/contact";

type Step = "roll" | "password" | "verify" | "create" | "not-listed" | "forgot";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>("roll");
  const [collegeRoll, setCollegeRoll] = useState("");
  const [uniRoll, setUniRoll] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [info, setInfo] = useState<{ short_name: string; name: string; college_roll: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const adminWa = useAdminWhatsapp();

  const fnLookup = useServerFn(lookupStudent);
  const fnVerify = useServerFn(verifyPassword);
  const fnCreate = useServerFn(createPassword);

  const finishLogin = (s: { college_roll: string; short_name: string }, adminToken?: string | null) => {
    localStorage.setItem("filevault_auth", "true");
    localStorage.setItem("filevault_user", s.short_name);
    localStorage.setItem("filevault_roll", s.college_roll);
    if (adminToken) localStorage.setItem("filevault_admin_token", adminToken);
    else localStorage.removeItem("filevault_admin_token");
    onSuccess();
  };

  const handleRollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const roll = collegeRoll.trim();
    try {
      const res = await fnLookup({ data: { roll } });
      setLoading(false);
      if (!res.found) { setStep("not-listed"); return; }
      setInfo({ short_name: res.short_name, name: res.name, college_roll: res.college_roll });
      setStep(res.has_password ? "password" : "verify");
    } catch {
      setLoading(false);
      setError("Something went wrong. Try again.");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setError("");
    setLoading(true);
    try {
      const res = await fnVerify({ data: { roll: info.college_roll, password } });
      setLoading(false);
      if (!res.ok || !res.student) { setError("Incorrect password"); return; }
      finishLogin({ college_roll: res.student.college_roll, short_name: res.student.short_name }, res.adminToken);
    } catch {
      setLoading(false);
      setError("Something went wrong");
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("create");
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setError("");
    if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
    if (password !== confirmPw) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fnCreate({ data: { roll: info.college_roll, uniRoll: uniRoll.trim(), password } });
      setLoading(false);
      if (!res.ok || !res.student) { setError(res.ok ? "Could not save" : (res.error || "Could not save")); return; }
      finishLogin({ college_roll: res.student.college_roll, short_name: res.student.short_name }, res.adminToken);
    } catch {
      setLoading(false);
      setError("Could not save password. Try again.");
    }
  };

  const goBack = () => {
    setError(""); setPassword(""); setConfirmPw(""); setUniRoll(""); setInfo(null);
    setStep("roll");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Upload className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {step === "roll" && "Sign In"}
              {step === "password" && `Welcome, ${info?.short_name}`}
              {step === "verify" && "Verify Identity"}
              {step === "create" && "Create Password"}
              {step === "not-listed" && "Not on the list"}
              {step === "forgot" && "Forgot password?"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {step === "roll" && "Enter your college roll number to continue"}
              {step === "password" && "Enter your password to sign in"}
              {step === "verify" && "Enter your university roll number to confirm it's you"}
              {step === "create" && "Set a password for future logins"}
              {step === "not-listed" && "Your college roll number isn't on our access list. Reach out to the admin on WhatsApp to be added."}
              {step === "forgot" && "Contact the admin on WhatsApp to reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "roll" && (
              <form onSubmit={handleRollSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="croll">College Roll No</Label>
                  <Input id="croll" type="text" inputMode="numeric" placeholder="e.g. 224"
                    value={collegeRoll} onChange={(e) => setCollegeRoll(e.target.value)} required autoFocus />
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw">Password</Label>
                  <div className="relative">
                    <Input id="pw" type={showPassword ? "text" : "password"} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button type="button" onClick={() => setStep("forgot")} className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                </div>
              </form>
            )}

            {step === "verify" && (
              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="uroll">University Roll No</Label>
                  <Input id="uroll" type="text" inputMode="numeric" placeholder="e.g. 112010"
                    value={uniRoll} onChange={(e) => setUniRoll(e.target.value)} required autoFocus />
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button type="submit" className="flex-1">Verify</Button>
                </div>
              </form>
            )}

            {step === "create" && (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="npw">New Password</Label>
                  <div className="relative">
                    <Input id="npw" type={showPassword ? "text" : "password"} placeholder="At least 4 characters"
                      value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpw">Confirm Password</Label>
                  <Input id="cpw" type={showPassword ? "text" : "password"} placeholder="Re-enter password"
                    value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Sign In"}
                  </Button>
                </div>
              </form>
            )}

            {(step === "not-listed" || step === "forgot") && (
              <div className="space-y-4">
                <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a href={waLink(adminWa)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" /> Message admin: {adminWa}
                  </a>
                </Button>
                <Button variant="outline" onClick={goBack} className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}