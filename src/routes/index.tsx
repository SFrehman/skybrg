import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoginForm } from "@/components/LoginForm";
import { FileUpload } from "@/components/FileUpload";
import { FileGallery } from "@/components/FileGallery";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Upload, Info, User, Shield } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkyBridge — Secure File Storage" },
      { name: "description", content: "Upload, organize, and access your files from anywhere." },
    ],
  }),
  component: Index,
});

function Index() {
  const [authed, setAuthed] = useState(false);
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("filevault_auth") === "true") {
      setAuthed(true);
      setUserName(localStorage.getItem("filevault_user") || "");
      setIsAdmin(localStorage.getItem("filevault_roll") === "224" && !!localStorage.getItem("filevault_admin_token"));
    }
  }, []);

  // Load avatar from students table
  useEffect(() => {
    if (!authed) return;
    const roll = localStorage.getItem("filevault_roll");
    if (!roll) return;
    supabase.from("students").select("avatar_url").eq("college_roll", roll).maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url || null));
  }, [authed]);

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
    return (
      <LoginForm
        onSuccess={() => {
          setAuthed(true);
          setUserName(localStorage.getItem("filevault_user") || "");
          setIsAdmin(localStorage.getItem("filevault_roll") === "224" && !!localStorage.getItem("filevault_admin_token"));
        }}
      />
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("filevault_auth");
    localStorage.removeItem("filevault_user");
    localStorage.removeItem("filevault_roll");
    localStorage.removeItem("filevault_admin_token");
    setUserName("");
    setAuthed(false);
  };

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
            {isAdmin && (
              <Button variant="ghost" size="icon" asChild title="Admin">
                <Link to="/admin"><Shield className="h-4 w-4" /></Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted overflow-hidden border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  aria-label="Profile menu"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-foreground">
                      {(userName?.[0] || "?").toUpperCase()}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-xs text-muted-foreground">Signed in as</div>
                  <div className="text-sm font-semibold">{userName || "Student"}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile"><User className="h-4 w-4 mr-2" /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/about"><Info className="h-4 w-4 mr-2" /> About</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
