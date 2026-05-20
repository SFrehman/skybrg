import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Image, Video, FileText, File, Download, Trash2, Loader2, Lock, Eye, EyeOff, CheckSquare, Square, Copy, Check, ClipboardType } from "lucide-react";
import { validatePasskey } from "@/lib/passkey";

interface FileRecord {
  id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: number;
  storage_path: string | null;
  text_content: string | null;
  created_at: string;
}

interface FileGalleryProps {
  files: FileRecord[];
  loading: boolean;
  onDelete: () => void;
}

function getFileCategory(type: string, isText: boolean): "images" | "videos" | "texts" | "others" {
  if (isText) return "texts";
  if (type.startsWith("image/")) return "images";
  if (type.startsWith("video/")) return "videos";
  return "others";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getPublicUrl(path: string | null): string {
  if (!path) return "";
  const { data } = supabase.storage.from("user-files").getPublicUrl(path);
  return data.publicUrl;
}

interface FileCardProps {
  file: FileRecord;
  onDelete: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
}

function FileCard({ file, onDelete, selectMode, selected, onToggleSelect, onLongPress }: FileCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePasskey, setDeletePasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [checkingPasskey, setCheckingPasskey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      onLongPress();
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const isText = file.text_content !== null && file.text_content !== undefined;
  const category = getFileCategory(file.file_type, isText);
  const url = getPublicUrl(file.storage_path);

  const handleDeleteConfirm = async () => {
    setDeleteError("");
    setCheckingPasskey(true);
    if (!(await validatePasskey(deletePasskey))) {
      setDeleteError("Invalid passkey");
      setCheckingPasskey(false);
      return;
    }
    setCheckingPasskey(false);
    setDeleting(true);
    try {
      if (file.storage_path) {
        await supabase.storage.from("user-files").remove([file.storage_path]);
      }
      await supabase.from("files").delete().eq("id", file.id);
      setShowDeleteDialog(false);
      onDelete();
    } catch {
      setDeleteError("Delete failed. Try again.");
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

  const handleCopy = async () => {
    if (!file.text_content) return;
    try {
      await navigator.clipboard.writeText(file.text_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleCardClick = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectMode) {
      onToggleSelect();
    } else if (isText) {
      setShowTextDialog(true);
    }
  };

  return (
    <>
      <Card
        className={`overflow-hidden group hover:shadow-lg transition-all relative ${
          selectMode ? "cursor-pointer" : ""
        } ${selected ? "ring-2 ring-primary" : ""}`}
        onClick={handleCardClick}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onContextMenu={(e) => {
          if (!selectMode) {
            e.preventDefault();
            onLongPress();
          }
        }}
      >
        {selectMode && (
          <div className="absolute top-2 left-2 z-10 bg-background/90 rounded p-1">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
          </div>
        )}
        <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
          {category === "images" ? (
            <img src={url} alt={file.display_name} className="w-full h-full object-cover" />
          ) : category === "videos" ? (
            <video src={url} className="w-full h-full object-cover" />
          ) : category === "texts" ? (
            <div className="w-full h-full p-3 overflow-hidden text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {file.text_content?.slice(0, 200)}
            </div>
          ) : (
            <FileText className="h-12 w-12 text-muted-foreground" />
          )}
          {!selectMode && (
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors hidden sm:flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              {isText ? (
                <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); void handleCopy(); }} className="h-9 w-9">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              ) : (
                <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="h-9 w-9">
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="destructive" onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }} disabled={deleting} className="h-9 w-9">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <p className="text-sm font-medium truncate text-foreground">{file.display_name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.file_size)}</p>
          {!selectMode && (
            <div className="flex gap-2 mt-2 sm:hidden">
              {isText ? (
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void handleCopy(); }} className="flex-1 gap-1">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="flex-1 gap-1">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }} disabled={deleting} className="flex-1 gap-1">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trash2 className="h-3.5 w-3.5" /> Delete</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTextDialog} onOpenChange={setShowTextDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardType className="h-5 w-5 text-primary" />
              {file.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
            {file.text_content}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTextDialog(false)}>Close</Button>
            <Button onClick={() => void handleCopy()} className="gap-1.5">
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy text</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeletePasskey(""); setDeleteError(""); setCheckingPasskey(false); setDeleting(false); setShowPasskey(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter passkey to delete <strong>{file.display_name}</strong></p>
            <Label>Passkey</Label>
            <div className="relative">
              <Input
                type={showPasskey ? "text" : "password"}
                placeholder="Enter passkey"
                value={deletePasskey}
                onChange={(e) => setDeletePasskey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleDeleteConfirm()}
                disabled={deleting || checkingPasskey}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasskey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDeleteConfirm()} disabled={deleting || checkingPasskey}>
              {checkingPasskey ? "Checking..." : deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FileGallery({ files, loading, onDelete }: FileGalleryProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkPasskey, setBulkPasskey] = useState("");
  const [showBulkPasskey, setShowBulkPasskey] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const isTextRecord = (f: FileRecord) => f.text_content !== null && f.text_content !== undefined;
  const images = files.filter((f) => getFileCategory(f.file_type, isTextRecord(f)) === "images");
  const videos = files.filter((f) => getFileCategory(f.file_type, isTextRecord(f)) === "videos");
  const texts = files.filter((f) => getFileCategory(f.file_type, isTextRecord(f)) === "texts");
  const others = files.filter((f) => getFileCategory(f.file_type, isTextRecord(f)) === "others");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectAllInTab = (items: FileRecord[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((f) => next.has(f.id));
      if (allSelected) items.forEach((f) => next.delete(f.id));
      else items.forEach((f) => next.add(f.id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkError("");
    if (!(await validatePasskey(bulkPasskey))) {
      setBulkError("Invalid passkey");
      return;
    }
    const targets = files.filter((f) => selectedIds.has(f.id));
    setBulkDeleting(true);
    setBulkProgress({ done: 0, total: targets.length });
    try {
      const paths = targets.map((f) => f.storage_path).filter((p): p is string => !!p);
      if (paths.length > 0) {
        await supabase.storage.from("user-files").remove(paths);
      }
      await supabase.from("files").delete().in("id", targets.map((f) => f.id));
      setBulkProgress({ done: targets.length, total: targets.length });
      setShowBulkDelete(false);
      setBulkPasskey("");
      setShowBulkPasskey(false);
      exitSelectMode();
      onDelete();
    } catch {
      setBulkError("Delete failed. Try again.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const renderGrid = (items: FileRecord[]) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <File className="h-10 w-10 mb-2" />
          <p className="text-sm">No files yet</p>
        </div>
      );
    }
    const allSelected = selectMode && items.every((f) => selectedIds.has(f.id));
    return (
      <>
        {selectMode && (
          <div className="mb-3">
            <Button variant="outline" size="sm" onClick={() => selectAllInTab(items)} className="gap-1.5">
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={onDelete}
              selectMode={selectMode}
              selected={selectedIds.has(file.id)}
              onToggleSelect={() => toggleSelect(file.id)}
              onLongPress={() => {
                if (!selectMode) setSelectMode(true);
                toggleSelect(file.id);
              }}
            />
          ))}
        </div>
      </>
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">Your Files</CardTitle>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => setShowBulkDelete(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
                <Button variant="outline" size="sm" onClick={exitSelectMode}>Cancel</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSelectMode(true)} disabled={files.length === 0} className="gap-1.5">
                <CheckSquare className="h-4 w-4" /> Select
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="images">
          <TabsList className="mb-4 grid w-full grid-cols-4 sm:inline-flex sm:w-auto">
            <TabsTrigger value="images" className="gap-1.5 px-2 sm:px-3">
              <Image className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Images</span>
              <span>({images.length})</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5 px-2 sm:px-3">
              <Video className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Videos</span>
              <span>({videos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="texts" className="gap-1.5 px-2 sm:px-3">
              <ClipboardType className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Texts</span>
              <span>({texts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="others" className="gap-1.5 px-2 sm:px-3">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Others</span>
              <span>({others.length})</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="images">{renderGrid(images)}</TabsContent>
          <TabsContent value="videos">{renderGrid(videos)}</TabsContent>
          <TabsContent value="texts">{renderGrid(texts)}</TabsContent>
          <TabsContent value="others">{renderGrid(others)}</TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={showBulkDelete} onOpenChange={(open) => { if (!open && !bulkDeleting) { setShowBulkDelete(false); setBulkPasskey(""); setBulkError(""); setShowBulkPasskey(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Delete {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter passkey to permanently delete the selected files.</p>
            <Label>Passkey</Label>
            <div className="relative">
              <Input
                type={showBulkPasskey ? "text" : "password"}
                placeholder="Enter passkey"
                value={bulkPasskey}
                onChange={(e) => setBulkPasskey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleBulkDelete()}
                disabled={bulkDeleting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowBulkPasskey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showBulkPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {bulkDeleting && (
              <p className="text-sm text-muted-foreground">Deleting {bulkProgress.done} of {bulkProgress.total}...</p>
            )}
            {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleBulkDelete()} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
