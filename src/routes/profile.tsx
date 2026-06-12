import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Upload, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { changePassword, updateAvatar, updateShortName } from "@/lib/auth.functions";
import { ContactFooter } from "@/components/ContactFooter";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — SkyBridge" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const fnChangePw = useServerFn(changePassword);
  const fnUpdateAvatar = useServerFn(updateAvatar);
  const fnUpdateShort = useServerFn(updateShortName);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{ college_roll: string; uni_roll: string; name: string; short_name: string; avatar_url: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [shortNameDraft, setShortNameDraft] = useState("");
  const [savingShort, setSavingShort] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const roll = typeof window !== "undefined" ? localStorage.getItem("filevault_roll") : null;
    if (!roll) { navigate({ to: "/" }); return; }
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("college_roll, uni_roll, name, short_name, avatar_url")
        .eq("college_roll", roll)
        .maybeSingle();
      if (data) setStudent(data as any);
      if (data?.short_name) setShortNameDraft(data.short_name);
      setLoading(false);
    })();
  }, [navigate]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${student.college_roll}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("user-files").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("user-files").getPublicUrl(path);
    const url = pub.publicUrl;
    try { await fnUpdateAvatar({ data: { roll: student.college_roll, avatarUrl: url } }); }
    catch { toast.error("Could not save"); setUploading(false); return; }
    setStudent({ ...student, avatar_url: url });
    toast.success("Profile picture updated");
    setUploading(false);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    if (newPw.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    setSavingPw(true);
    try {
      const res = await fnChangePw({ data: { roll: student.college_roll, oldPassword: oldPw, newPassword: newPw } });
      setSavingPw(false);
      if (!res.ok) { toast.error(res.error || "Could not update password"); return; }
    } catch { setSavingPw(false); toast.error("Could not update password"); return; }
    setOldPw(""); setNewPw(""); setConfirmPw("");
    toast.success("Password updated");
  };

  const handleSaveShortName = async () => {
    if (!student) return;
    const val = shortNameDraft.trim();
    if (!val || val === student.short_name) return;
    setSavingShort(true);
    try {
      const res = await fnUpdateShort({ data: { roll: student.college_roll, shortName: val } });
      if (!res.ok) { toast.error(res.error || "Could not save"); setSavingShort(false); return; }
      setStudent({ ...student, short_name: val });
      localStorage.setItem("filevault_user", val);
      toast.success("Nickname updated");
    } catch { toast.error("Could not save"); }
    setSavingShort(false);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!student) {
    return <div className="p-6">Profile not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Link>
          </Button>
          <span className="font-semibold">My Profile</span>
          <span className="w-16" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl w-full p-4 sm:p-6 space-y-6 flex-1">
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Upload a photo to personalize your account</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {student.avatar_url ? (
                <img src={student.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                student.short_name?.[0] || "?"
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatar} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>College Roll No</Label>
              <Input value={student.college_roll} disabled />
              <p className="text-xs text-muted-foreground">This cannot be changed.</p>
            </div>
            <div className="space-y-1">
              <Label>University Roll No</Label>
              <Input value={student.uni_roll} disabled />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={student.name} disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="snick">Nickname</Label>
              <div className="flex gap-2">
                <Input id="snick" value={shortNameDraft} onChange={(e) => setShortNameDraft(e.target.value)} maxLength={40} />
                <Button type="button" onClick={handleSaveShortName} disabled={savingShort || !shortNameDraft.trim() || shortNameDraft.trim() === student.short_name}>
                  {savingShort ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This is the name shown across the app.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="op">Current Password</Label>
                <div className="relative">
                  <Input id="op" type={showPw ? "text" : "password"} value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="np">New Password</Label>
                <Input id="np" type={showPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cp">Confirm New Password</Label>
                <Input id="cp" type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
              </div>
              <Button type="submit" disabled={savingPw}>
                {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <ContactFooter />
    </div>
  );
}