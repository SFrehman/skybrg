import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const ADMIN_ROLL = "224";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SkyBridge" }] }),
  component: AdminPage,
});

interface SignupRequest {
  id: string;
  college_roll: string;
  uni_roll: string;
  name: string;
  short_name: string;
  whatsapp: string;
  status: string;
  created_at: string;
}

function AdminPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const roll = typeof window !== "undefined" ? localStorage.getItem("filevault_roll") : null;
    if (roll !== ADMIN_ROLL) { navigate({ to: "/" }); return; }
    setAllowed(true);
  }, [navigate]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("signup_requests").select("*").order("created_at", { ascending: false });
    setRequests((data || []) as SignupRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed) fetchRequests(); }, [allowed, fetchRequests]);

  const approve = async (r: SignupRequest) => {
    setBusyId(r.id);
    // Insert into students (no password yet — they'll create on first login)
    const { error: insErr } = await supabase.from("students").insert({
      college_roll: r.college_roll,
      uni_roll: r.uni_roll,
      name: r.name,
      short_name: r.short_name,
    });
    if (insErr && !String(insErr.message || "").toLowerCase().includes("duplicate")) {
      toast.error("Could not create account: " + insErr.message);
      setBusyId(null); return;
    }
    await supabase.from("signup_requests").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", r.id);
    toast.success(`Approved ${r.short_name}`);
    setBusyId(null);
    fetchRequests();
  };

  const reject = async (r: SignupRequest) => {
    setBusyId(r.id);
    await supabase.from("signup_requests").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", r.id);
    setBusyId(null);
    fetchRequests();
  };

  const waLink = (num: string) => {
    const clean = num.replace(/[^\d]/g, "");
    return `https://wa.me/${clean}`;
  };

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
      <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Account Requests</CardTitle>
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
                      <div className="flex items-center gap-2">
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
      </main>
    </div>
  );
}