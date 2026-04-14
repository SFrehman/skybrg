import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { FileUpload } from "@/components/FileUpload";
import { FileGallery } from "@/components/FileGallery";
import { Button } from "@/components/ui/button";
import { LogOut, Upload } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FileVault — Secure File Storage" },
      { name: "description", content: "Upload, organize, and access your files from anywhere." },
    ],
  }),
  component: Index,
});

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Array<{
    id: string;
    file_name: string;
    display_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    created_at: string;
  }>>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchFiles = useCallback(async () => {
    if (!session?.user) return;
    setFilesLoading(true);
    const { data } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false });
    setFiles(data || []);
    setFilesLoading(false);
  }, [session?.user]);

  useEffect(() => {
    if (session?.user) fetchFiles();
  }, [session?.user, fetchFiles]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <LoginForm onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Upload className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">FileVault</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{session.user.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <FileUpload userId={session.user.id} onUploadComplete={fetchFiles} />
        <FileGallery files={files} loading={filesLoading} onDelete={fetchFiles} />
      </main>
    </div>
  );
}
