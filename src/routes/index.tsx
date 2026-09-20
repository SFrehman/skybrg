import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";
import { FileGallery } from "@/components/FileGallery";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Upload, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkyBridge — Secure File Storage" },
      { name: "description", content: "Upload, organize, and access your files from anywhere." },
      { property: "og:title", content: "SkyBridge — Secure File Storage" },
      { property: "og:description", content: "Upload, organize, and access your files from anywhere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [files, setFiles] = useState<Array<{
    id: string;
    file_name: string;
    display_name: string;
    file_type: string;
    file_size: number;
    storage_path: string | null;
    text_content: string | null;
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
    fetchFiles();
  }, [fetchFiles]);

  // Realtime subscription - auto-sync files across devices
  useEffect(() => {
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
  }, [fetchFiles]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 sm:px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Upload className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">SkyBridge</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild title="About">
              <Link to="/about"><Info className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <FileUpload onUploadComplete={fetchFiles} />
        <FileGallery files={files} loading={filesLoading} onDelete={fetchFiles} />
      </main>
    </div>
  );
}
