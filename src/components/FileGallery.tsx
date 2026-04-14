import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Image, Video, FileText, File, Download, Trash2, Loader2 } from "lucide-react";

interface FileRecord {
  id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

interface FileGalleryProps {
  files: FileRecord[];
  loading: boolean;
  onDelete: () => void;
}

function getFileCategory(type: string): "images" | "videos" | "others" {
  if (type.startsWith("image/")) return "images";
  if (type.startsWith("video/")) return "videos";
  return "others";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from("user-files").getPublicUrl(path);
  return data.publicUrl;
}

function FileCard({ file, onDelete }: { file: FileRecord; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const category = getFileCategory(file.file_type);
  const url = getPublicUrl(file.storage_path);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.storage.from("user-files").remove([file.storage_path]);
      await supabase.from("files").delete().eq("id", file.id);
      onDelete();
    } catch {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.file_name;
    a.target = "_blank";
    a.click();
  };

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {category === "images" ? (
          <img src={url} alt={file.display_name} className="w-full h-full object-cover" />
        ) : category === "videos" ? (
          <video src={url} className="w-full h-full object-cover" />
        ) : (
          <FileText className="h-12 w-12 text-muted-foreground" />
        )}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button size="icon" variant="secondary" onClick={handleDownload} className="h-9 w-9">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="destructive" onClick={handleDelete} disabled={deleting} className="h-9 w-9">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-medium truncate text-foreground">{file.display_name}</p>
        <p className="text-xs text-muted-foreground">{formatSize(file.file_size)}</p>
      </CardContent>
    </Card>
  );
}

export function FileGallery({ files, loading, onDelete }: FileGalleryProps) {
  const images = files.filter((f) => getFileCategory(f.file_type) === "images");
  const videos = files.filter((f) => getFileCategory(f.file_type) === "videos");
  const others = files.filter((f) => getFileCategory(f.file_type) === "others");

  const renderGrid = (items: FileRecord[]) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <File className="h-10 w-10 mb-2" />
          <p className="text-sm">No files yet</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((file) => (
          <FileCard key={file.id} file={file} onDelete={onDelete} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Files</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="images">
          <TabsList className="mb-4">
            <TabsTrigger value="images" className="gap-1.5">
              <Image className="h-4 w-4" /> Images ({images.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5">
              <Video className="h-4 w-4" /> Videos ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="others" className="gap-1.5">
              <FileText className="h-4 w-4" /> Others ({others.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="images">{renderGrid(images)}</TabsContent>
          <TabsContent value="videos">{renderGrid(videos)}</TabsContent>
          <TabsContent value="others">{renderGrid(others)}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
