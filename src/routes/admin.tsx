import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, RotateCcw, Users, UserPlus, Trash2, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import {
  adminListStudents, adminResetStudent, adminAddStudent, adminRemoveStudent, adminSetWhatsapp,
} from "@/lib/auth.functions";
import { useAdminWhatsapp, setAdminWhatsappCache, waLink } from "@/lib/contact";
import { ContactFooter } from "@/components/ContactFooter";

const ADMIN_ROLL = "224";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SkyBridge" }] }),
  component: AdminPage,
});

interface StudentRow {
  college_roll: string; uni_roll: string; name: string;
  short_name: string; avatar_url: string | null; has_password: boolean;
}

function AdminPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ college_roll: "", uni_roll: "", name: "", short_name: "" });
  const [addBusy, setAddBusy] = useState(false);
  const currentWa = useAdminWhatsapp();
  const [waInput, setWaInput] = useState("");
  const [waBusy, setWaBusy] = useState(false);

  const fnList = useServerFn(adminListStudents);
  const fnReset = useServerFn(adminResetStudent);
  const fnAdd = useServerFn(adminAddStudent);
  const fnRemove = useServerFn(adminRemoveStudent);
  const fnSetWa = useServerFn(adminSetWhatsapp);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const roll = localStorage.getItem("filevault_roll");
    const token = localStorage.getItem("filevault_admin_token") || "";
    if (roll !== ADMIN_ROLL || !token) { navigate({ to: "/" }); return; }
    setAdminToken(token);
    setAllowed(true);
  }, [navigate]);

  useEffect(() => { setWaInput(currentWa); }, [currentWa]);

  const refresh = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const s = await fnList({ data: { adminToken } });
      setStudents(s as StudentRow[]);
    } catch {
      toast.error("Admin session expired. Please sign in again.");
    }
    setLoading(false);
  }, [adminToken, fnList]);

  useEffect(() => { if (allowed) refresh(); }, [allowed, refresh]);

  const resetUser = async (s: StudentRow) => {
    setBusyId(s.college_roll);
    try {
      const res = await fnReset({ data: { adminToken, roll: s.college_roll } });
      if (!res.ok) toast.error(res.error || "Could not reset");
      else toast.success(`${s.short_name} reset. They can sign in again to create a new password.`);
    } catch { toast.error("Could not reset"); }
    setBusyId(null); refresh();
  };

  const removeUser = async (s: StudentRow) => {
    setBusyId(s.college_roll);
    try {
      const res = await fnRemove({ data: { adminToken, roll: s.college_roll } });
      if (!res.ok) toast.error(res.error || "Could not remove");
      else toast.success(`${s.short_name} removed`);
    } catch { toast.error("Could not remove"); }
    setBusyId(null); refresh();
  };

  const submitAdd = async () => {
    setAddBusy(true);
    try {
      const res = await fnAdd({ data: { adminToken, ...addForm } });
      if (!res.ok) { toast.error(res.error || "Could not add"); setAddBusy(false); return; }
      toast.success(`Added ${addForm.name}`);
      setAddForm({ college_roll: "", uni_roll: "", name: "", short_name: "" });
      setAddOpen(false);
    } catch { toast.error("Could not add"); }
    setAddBusy(false); refresh();
  };

  const saveWhatsapp = async () => {
    const val = waInput.trim();
    if (!val) { toast.error("Number required"); return; }
    setWaBusy(true);
    try {
      const res = await fnSetWa({ data: { adminToken, whatsapp: val } });
      if (!res.ok) toast.error(res.error || "Could not save");
      else { setAdminWhatsappCache(val); toast.success("Contact number updated"); }
    } catch { toast.error("Could not save"); }
    setWaBusy(false);
  };

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl w-full flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Link>
          </Button>
          <span className="font-semibold">Admin Panel</span>
          <span className="w-16" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl w-full p-4 sm:p-6 space-y-6 flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Contact Number</CardTitle>
            <CardDescription>Shown to students who need access or password help. Visible on every page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="wanum">WhatsApp number</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input id="wanum" value={waInput} onChange={(e) => setWaInput(e.target.value)} placeholder="03153857725" />
              <Button onClick={saveWhatsapp} disabled={waBusy} className="gap-1.5">
                {waBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
            <a href={waLink(currentWa)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <MessageCircle className="h-3 w-3" /> Preview WhatsApp link
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Access List ({students.length})</CardTitle>
              <CardDescription>Add, remove, or reset students on the access list.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No users.</p>
            ) : (
              <div className="space-y-2">
                {students.map((s) => (
                  <div key={s.college_roll} className="border border-border rounded-lg p-3 flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
                        {s.avatar_url ? <img src={s.avatar_url} alt="" className="h-full w-full object-cover" /> : (s.short_name?.[0] || "?")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name} <span className="text-muted-foreground text-sm">({s.short_name})</span></p>
                        <div className="flex gap-2 items-center text-xs text-muted-foreground flex-wrap">
                          <span>Roll: {s.college_roll}</span>
                          <span>·</span>
                          <span>Uni: {s.uni_roll}</span>
                          <Badge variant={s.has_password ? "secondary" : "outline"} className="text-[10px]">
                            {s.has_password ? "Active" : "Awaiting setup"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {s.college_roll !== ADMIN_ROLL && (
                      <div className="flex gap-1.5">
                        {s.has_password && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" disabled={busyId === s.college_roll} title="Reset password">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reset {s.short_name}'s account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deletes their password. They'll verify with their university roll and set a new one.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => resetUser(s)}>Reset</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={busyId === s.college_roll} title="Remove from list" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {s.short_name} from list?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This deletes their account permanently. They can no longer sign in unless re-added.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeUser(s)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <ContactFooter />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>College Roll No</Label>
              <Input value={addForm.college_roll} onChange={(e) => setAddForm({ ...addForm, college_roll: e.target.value })} placeholder="e.g. 228" /></div>
            <div className="space-y-1"><Label>University Roll No</Label>
              <Input value={addForm.uni_roll} onChange={(e) => setAddForm({ ...addForm, uni_roll: e.target.value })} placeholder="e.g. 112012" /></div>
            <div className="space-y-1"><Label>Full Name</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Nickname (optional)</Label>
              <Input value={addForm.short_name} onChange={(e) => setAddForm({ ...addForm, short_name: e.target.value })} placeholder="Defaults to first name" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addBusy}>
              {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}