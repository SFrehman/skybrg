import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoginForm } from "@/components/LoginForm";
import { FileUpload } from "@/components/FileUpload";
import { FileGallery } from "@/components/FileGallery";
import { PasskeyReset } from "@/components/PasskeyReset";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut, Upload } from "lucide-react";

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
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("filevault_auth") === "true") {
      setAuthed(true);
    }
  }, []);

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

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    const { data } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false });
    setFiles(data || []);
    setFilesLoading(false);
  }, []);

  useEffect(() => {
    if (authed) fetchFiles();
  }, [authed, fetchFiles]);

  // Realtime subscription - auto-sync files across devices
  useEffect(() => {
    if (!authed) return;

    const channel = supabase
      .channel("files-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "files" },
        () => {
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, fetchFiles]);

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />;
  }

  const handleLogout = () => {
    localStorage.removeItem("filevault_auth");
    setAuthed(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Upload className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">FileVault</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">Saif</span>
            <ThemeToggle />
            <PasskeyReset />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <FileUpload onUploadComplete={fetchFiles} />
        <FileGallery files={files} loading={filesLoading} onDelete={fetchFiles} />
      </main>
    </div>
  );
}
