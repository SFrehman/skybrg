import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import introVideo from "@/assets/intro.mp4";
import { supabase } from "@/integrations/supabase/client";

type Step = "roll" | "password" | "verify" | "create" | "request" | "request-sent";

interface Student {
  college_roll: string;
  uni_roll: string;
  name: string;
  short_name: string;
  password_hash: string | null;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const hashPw = (pw: string, roll: string) => sha256(pw.trim() + ":" + roll.trim());

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>("roll");
  const [collegeRoll, setCollegeRoll] = useState("");
  const [uniRoll, setUniRoll] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqShort, setReqShort] = useState("");
  const [reqWhats, setReqWhats] = useState("");

  const [introDone, setIntroDone] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", introVideo, true);
    xhr.responseType = "blob";
    xhr.onload = () => {
      if (xhr.status === 200 && videoRef.current) {
        const blobUrl = URL.createObjectURL(xhr.response);
        videoRef.current.src = blobUrl;
        videoRef.current.load();
      }
    };
    xhr.onerror = () => setIntroDone(true);
    xhr.send();
  }, []);

  const finishLogin = (s: Student) => {
    localStorage.setItem("filevault_auth", "true");
    localStorage.setItem("filevault_user", s.short_name);
    localStorage.setItem("filevault_roll", s.college_roll);
    onSuccess();
  };

  const handleRollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const roll = collegeRoll.trim();
    const { data, error: err } = await supabase
      .from("students")
      .select("college_roll, uni_roll, name, short_name, password_hash")
      .eq("college_roll", roll)
      .maybeSingle();
    setLoading(false);
    if (err) { setError("Something went wrong. Try again."); return; }
    if (!data) {
      // Not whitelisted — offer request flow
      setStep("request");
      return;
    }
    setStudent(data as Student);
    setStep(data.password_hash ? "password" : "verify");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setError("");
    setLoading(true);
    const h = await hashPw(password, student.college_roll);
    setLoading(false);
    if (h !== student.password_hash) { setError("Incorrect password"); return; }
    finishLogin(student);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setError("");
    if (uniRoll.trim() !== student.uni_roll) {
      setError("University roll number does not match");
      return;
    }
    setStep("create");
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setError("");
    if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
    if (password !== confirmPw) { setError("Passwords do not match"); return; }
    setLoading(true);
    const h = await hashPw(password, student.college_roll);
    const { error: err } = await supabase
      .from("students")
      .update({ password_hash: h, updated_at: new Date().toISOString() })
      .eq("college_roll", student.college_roll);
    setLoading(false);
    if (err) { setError("Could not save password. Try again."); return; }
    finishLogin({ ...student, password_hash: h });
  };

  const goBack = () => {
    setError("");
    setPassword("");
    setConfirmPw("");
    setUniRoll("");
    setStudent(null);
    setReqName("");
    setReqShort("");
    setReqWhats("");
    setStep("roll");
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reqName.trim() || !uniRoll.trim() || !reqWhats.trim()) {
      setError("Please fill all fields"); return;
    }
    setLoading(true);
    const shortName = (reqShort.trim() || reqName.trim().split(" ")[0]);
    const { error: err } = await supabase.from("signup_requests").insert({
      college_roll: collegeRoll.trim(),
      uni_roll: uniRoll.trim(),
      name: reqName.trim(),
      short_name: shortName,
      whatsapp: reqWhats.trim(),
      status: "pending",
    });
    setLoading(false);
    if (err) { setError("Could not send request. Try again."); return; }
    setStep("request-sent");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {!introDone && (
        <video
          ref={videoRef}
          muted
          playsInline
          onCanPlayThrough={() => {
            if (!introReady) {
              setIntroReady(true);
              videoRef.current?.play().catch(() => setIntroDone(true));
            }
          }}
          onEnded={(e) => {
            const v = e.currentTarget;
            v.pause();
            setIntroDone(true);
          }}
          className="fixed inset-0 z-[100] h-full w-full object-cover bg-black"
        />
      )}
      <div className="w-full max-w-md">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Upload className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {step === "roll" && "Sign In"}
              {step === "password" && `Welcome, ${student?.short_name}`}
              {step === "verify" && "Verify Identity"}
              {step === "create" && "Create Password"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {step === "roll" && "Enter your college roll number to continue"}
              {step === "password" && "Enter your password to sign in"}
              {step === "verify" && "Enter your university roll number to confirm it's you"}
              {step === "create" && "Set a password for future logins"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "roll" && (
              <form onSubmit={handleRollSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="croll">College Roll No</Label>
                  <Input
                    id="croll"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 224"
                    value={collegeRoll}
                    onChange={(e) => setCollegeRoll(e.target.value)}
                    required
                    autoFocus
                  />
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
                    <Input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
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
                  <Input
                    id="uroll"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 112010"
                    value={uniRoll}
                    onChange={(e) => setUniRoll(e.target.value)}
                    required
                    autoFocus
                  />
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
                    <Input
                      id="npw"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 4 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
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
                  <Label htmlFor="cpw">Confirm Password</Label>
                  <Input
                    id="cpw"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                  />
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
