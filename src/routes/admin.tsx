import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, X, Loader2, MessageCircle, RotateCcw, Users, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  adminListStudents, adminResetStudent, adminListSignupRequests, adminApproveSignup, adminRejectSignup,
} from "@/lib/auth.functions";

const ADMIN_ROLL = "224";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SkyBridge" }] }),
  component: AdminPage,
});

interface SignupRequest {
  id: string; college_roll: string; uni_roll: string; name: string;
  short_name: string; whatsapp: string; status: string; created_at: string;
}
interface StudentRow {
  college_roll: string; uni_roll: string; name: string;
  short_name: string; avatar_url: string | null; has_password: boolean;
}

function AdminPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fnList = useServerFn(adminListStudents);
  const fnReset = useServerFn(adminResetStudent);
  const fnReqs = useServerFn(adminListSignupRequests);
  const fnApprove = useServerFn(adminApproveSignup);
  const fnReject = useServerFn(adminRejectSignup);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const roll = localStorage.getItem("filevault_roll");
    const token = localStorage.getItem("filevault_admin_token") || "";
    if (roll !== ADMIN_ROLL || !token) { navigate({ to: "/" }); return; }
    setAdminToken(token);
    setAllowed(true);
  }, [navigate]);

  const refresh = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fnList({ data: { adminToken: adminToken } }),
        fnReqs({ data: { adminToken: adminToken } }),
      ]);
      setStudents(s as StudentRow[]);
      setRequests(r as SignupRequest[]);
    } catch {
      toast.error("Admin session expired. Please sign in again.");
    }
    setLoading(false);
  }, [adminToken, fnList, fnReqs]);

  useEffect(() => { if (allowed) refresh(); }, [allowed, refresh]);

  const approve = async (r: SignupRequest) => {
    setBusyId(r.id);
    try {
      const res = await fnApprove({ data: { adminToken: adminToken, id: r.id } });
      if (!res.ok) toast.error(res.error || "Could not approve"); else toast.success(`Approved ${r.short_name}`);
    } catch { toast.error("Could not approve"); }
    setBusyId(null); refresh();
  };
  const reject = async (r: SignupRequest) => {
    setBusyId(r.id);
    try { await fnReject({ data: { adminToken: adminToken, id: r.id } }); } catch { /* noop */ }
    setBusyId(null); refresh();
  };
  const resetUser = async (s: StudentRow) => {
    setBusyId(s.college_roll);
    try {
      const res = await fnReset({ data: { adminToken: adminToken, roll: s.college_roll } });
      if (!res.ok) toast.error(res.error || "Could not reset");
      else toast.success(`${s.short_name}'s account reset. They can sign in to create a new password.`);
    } catch { toast.error("Could not reset"); }
    setBusyId(null); refresh();
  };

  const waLink = (num: string) => `https://wa.me/${num.replace(/[^\d]/g, "")}`;
  const pending = requests.filter((r) => r.status === "pending");

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Link>
          </Button>
          <span className="font-semibold">Admin Panel</span>
          <span className="w-16" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> Access Requests {pending.length > 0 && <Badge>{pending.length}</Badge>}</CardTitle>
            <CardDescription>Review and approve new student access requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No requests yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{r.name} <span className="text-muted-foreground">({r.short_name})</span></p>
                        <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">College Roll: {r.college_roll} · Uni Roll: {r.uni_roll}</p>
                      <a href={waLink(r.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <MessageCircle className="h-3 w-3" /> {r.whatsapp}
                      </a>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approve(r)} disabled={busyId === r.id}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reject(r)} disabled={busyId === r.id}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All Users ({students.length})</CardTitle>
            <CardDescription>Reset a user's account to force them to create a new password on next sign-in.</CardDescription>
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
                    {s.college_roll !== ADMIN_ROLL && s.has_password && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={busyId === s.college_roll}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset {s.short_name}'s account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This deletes their password. They'll need to verify with their university roll and set a new password to sign in again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => resetUser(s)}>Reset Account</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}