import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileFast } from "@/lib/resumable-upload";
import { Upload, FileUp, X, ClipboardType, FolderUp, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

interface FileUploadProps {
  onUploadComplete: () => void;
}

interface PendingFile {
  file: File;
  displayName: string;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [step, setStep] = useState<"select" | "name" | "uploading">("select");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [bytesProgress, setBytesProgress] = useState({ uploaded: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Text snippet state
  const [textStep, setTextStep] = useState<"closed" | "compose" | "saving">("closed");
  const [textName, setTextName] = useState("");
  const [textBody, setTextBody] = useState("");
  const [textError, setTextError] = useState("");

  const resetTextState = () => {
    setTextStep("closed");
    setTextName("");
    setTextBody("");
    setTextError("");
  };

  const handleTextSave = async () => {
    if (!textName.trim()) { setTextError("Name is required"); return; }
    if (!textBody.trim()) { setTextError("Text content is required"); return; }
    setTextError("");
    setTextStep("saving");
    const body = textBody;
    const name = textName.trim();
    try {
      const { error: dbError } = await supabase.from("files").insert({
        file_name: `${name}.txt`,
        display_name: name,
        file_type: "text/plain",
        file_size: new Blob([body]).size,
        storage_path: null,
        text_content: body,
      });
      if (dbError) throw dbError;
      resetTextState();
      onUploadComplete();
    } catch (err: unknown) {
      setTextError(err instanceof Error ? err.message : "Failed to save");
      setTextStep("compose");
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setPending(
      arr.map((f) => ({ file: f, displayName: f.name.replace(/\.[^.]+$/, "") }))
    );
    setStep("name");
    setError("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  type RelFile = { file: File; relPath: string };

  const zipAndUploadFolder = async (folderName: string, entries: RelFile[]) => {
    if (entries.length === 0) return;
    setZipping(true);
    setZipProgress(0);
    try {
      const zip = new JSZip();
      for (const { file, relPath } of entries) {
        const inner = relPath.includes("/") ? relPath.substring(relPath.indexOf("/") + 1) : relPath;
        zip.file(inner, file);
      }
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
        (meta) => setZipProgress(Math.round(meta.percent))
      );
      const zipFile = new File([blob], `${folderName}.zip`, { type: "application/zip" });
      setZipping(false);
      setZipProgress(0);
      toast.success(`Folder "${folderName}" ready`, {
        description: `${entries.length} files · ${(blob.size / 1024 / 1024).toFixed(2)} MB. Uploading…`,
      });
      const stamp = Date.now();
      const filePath = `uploads/${stamp}_${zipFile.name}`;
      const totalBytes = zipFile.size;
      const uploadingToast = toast.loading(`Uploading "${folderName}"…`, {
        description: `0 / ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
      });
      await uploadFileFast("user-files", filePath, zipFile, (uploaded) => {
        toast.loading(`Uploading "${folderName}"…`, {
          id: uploadingToast,
          description: `${(uploaded / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
        });
      });
      const { error: dbError } = await supabase.from("files").insert({
        file_name: zipFile.name,
        display_name: folderName,
        file_type: "application/zip",
        file_size: zipFile.size,
        storage_path: filePath,
      });
      if (dbError) throw dbError;
      toast.success(`Folder "${folderName}" uploaded`, { id: uploadingToast });
      onUploadComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to package folder";
      toast.error(msg);
    } finally {
      setZipping(false);
      setZipProgress(0);
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const firstRel = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || files[0].name;
    const folderName = firstRel.split("/")[0] || "folder";
    const entries: RelFile[] = files.map((f) => ({
      file: f,
      relPath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }));
    try {
      await zipAndUploadFolder(folderName, entries);
    } finally {
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  // Recursively read a dropped DirectoryEntry into RelFile[]
  const readEntry = (entry: FileSystemEntry, pathPrefix: string): Promise<RelFile[]> => {
    return new Promise((resolve, reject) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file(
          (file) => resolve([{ file, relPath: `${pathPrefix}${entry.name}` }]),
          reject,
        );
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const all: FileSystemEntry[] = [];
        const readBatch = () => {
          reader.readEntries(async (batch) => {
            if (batch.length === 0) {
              try {
                const nested = await Promise.all(
                  all.map((c) => readEntry(c, `${pathPrefix}${entry.name}/`)),
                );
                resolve(nested.flat());
              } catch (e) { reject(e); }
            } else {
              all.push(...batch);
              readBatch();
            }
          }, reject);
        };
        readBatch();
      } else {
        resolve([]);
      }
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const topEntries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind !== "file") continue;
        const entry = it.webkitGetAsEntry?.();
        if (entry) topEntries.push(entry);
      }
      const dirEntries = topEntries.filter((en) => en.isDirectory);
      if (dirEntries.length > 0) {
        try {
          for (const dir of dirEntries) {
            const files = await readEntry(dir, "");
            await zipAndUploadFolder(dir.name, files);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to read folder";
          toast.error(msg);
        }
        // Also handle any plain files dropped alongside folders
        const plainFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const entry = it.webkitGetAsEntry?.();
          if (entry && entry.isFile) {
            const f = it.getAsFile();
            if (f) plainFiles.push(f);
          }
        }
        if (plainFiles.length > 0) addFiles(plainFiles);
        return;
      }
    }
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (pending.length === 0 || pending.some((p) => !p.displayName.trim())) {
      setError("All files need a display name");
      return;
    }
    setStep("uploading");
    setError("");
    setProgress({ done: 0, total: pending.length });
    const totalBytes = pending.reduce((s, p) => s + p.file.size, 0);
    setBytesProgress({ uploaded: 0, total: totalBytes });

    try {
      const CONCURRENCY = 4;
      const stamp = Date.now();
      const rows: Array<{
        file_name: string;
        display_name: string;
        file_type: string;
        file_size: number;
        storage_path: string;
      }> = new Array(pending.length);
      let done = 0;
      let cursor = 0;
      const perFileUploaded = new Array<number>(pending.length).fill(0);

      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= pending.length) return;
          const { file, displayName } = pending[i];
          const filePath = `uploads/${stamp}_${i}_${file.name}`;
          await uploadFileFast("user-files", filePath, file, (uploaded) => {
            perFileUploaded[i] = uploaded;
            const sum = perFileUploaded.reduce((a, b) => a + b, 0);
            setBytesProgress({ uploaded: sum, total: totalBytes });
          });
          perFileUploaded[i] = file.size;
          const fileExt = file.name.split(".").pop();
          rows[i] = {
            file_name: file.name,
            display_name: displayName.trim(),
            file_type: file.type || `application/${fileExt}`,
            file_size: file.size,
            storage_path: filePath,
          };
          done++;
          setProgress({ done, total: pending.length });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
      );

      const { error: dbError } = await supabase.from("files").insert(rows);
      if (dbError) throw dbError;

      resetState();
      onUploadComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("name");
    }
  };

  const resetState = () => {
    setPending([]);
    setStep("select");
    setError("");
    setProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePending = (idx: number) => {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateName = (idx: number, name: string) => {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, displayName: name } : p)));
  };

  return (
    <>
      <Card className="border-dashed border-2 border-border hover:border-primary/40 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`flex flex-col items-center justify-center py-8 cursor-pointer rounded-xl transition-colors ${
              isDragging ? "bg-primary/10 border-2 border-primary border-dashed" : "bg-muted/50 hover:bg-muted"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <FileUp className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Drop files or a folder here" : "Click or drag files / folders to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Drop a folder to auto-zip & upload</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleFolderSelect(e)}
            // @ts-expect-error non-standard but widely supported attributes
            webkitdirectory=""
            directory=""
            mozdirectory=""
          />
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => folderInputRef.current?.click()}
              disabled={zipping}
            >
              {zipping ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Packaging {zipProgress}%</>
              ) : (
                <><FolderUp className="h-4 w-4" /> Upload folder</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setTextStep("compose")}
            >
              <ClipboardType className="h-4 w-4" /> Paste text
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={step === "passkey"} onOpenChange={(open) => !open && resetState()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Enter Passkey
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Passkey to upload {pending.length} file{pending.length !== 1 ? "s" : ""}</Label>
            <div className="relative">
              <Input
                type={showPasskey ? "text" : "password"}
                placeholder="Enter passkey"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handlePasskeySubmit()}
                disabled={verifyingPasskey}
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
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetState}>Cancel</Button>
            <Button onClick={() => void handlePasskeySubmit()} disabled={verifyingPasskey}>
              {verifyingPasskey ? "Checking..." : "Verify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "name" || step === "uploading"} onOpenChange={(open) => !open && step !== "uploading" && resetState()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Name Your Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {pending.map((p, i) => (
              <div key={i} className="space-y-1 border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <Label className="text-xs text-muted-foreground truncate flex-1">
                    {p.file.name} ({(p.file.size / 1024 / 1024).toFixed(2)} MB)
                  </Label>
                  {step !== "uploading" && pending.length > 1 && (
                    <button
                      onClick={() => removePending(i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Display name"
                  value={p.displayName}
                  onChange={(e) => updateName(i, e.target.value)}
                  disabled={step === "uploading"}
                />
              </div>
            ))}
            {step === "uploading" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Uploading {progress.done} of {progress.total}
                  {bytesProgress.total > 0 && (
                    <> &middot; {(bytesProgress.uploaded / 1024 / 1024).toFixed(1)} / {(bytesProgress.total / 1024 / 1024).toFixed(1)} MB</>
                  )}
                </p>
                {bytesProgress.total > 0 && (
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (bytesProgress.uploaded / bytesProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetState} disabled={step === "uploading"}>Cancel</Button>
            <Button onClick={handleUpload} disabled={step === "uploading" || pending.length === 0}>
              {step === "uploading" ? "Uploading..." : `Upload ${pending.length} file${pending.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textStep === "compose"} onOpenChange={(open) => !open && resetTextState()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardType className="h-5 w-5 text-primary" />
              New Text Snippet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Wifi password"
                value={textName}
                onChange={(e) => setTextName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Text</Label>
              <Textarea
                placeholder="Paste or type your text here..."
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={8}
              />
            </div>
            {textError && <p className="text-sm text-destructive">{textError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTextState}>Cancel</Button>
            <Button onClick={handleTextNext}>Next</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textStep === "passkey" || textStep === "saving"} onOpenChange={(open) => !open && textStep !== "saving" && resetTextState()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Enter Passkey
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Passkey to save text snippet</Label>
            <div className="relative">
              <Input
                type={showTextPasskey ? "text" : "password"}
                placeholder="Enter passkey"
                value={textPasskey}
                onChange={(e) => setTextPasskey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleTextSave()}
                disabled={verifyingTextPasskey || textStep === "saving"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowTextPasskey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showTextPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {textError && <p className="text-sm text-destructive">{textError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTextState} disabled={textStep === "saving"}>Cancel</Button>
            <Button onClick={() => void handleTextSave()} disabled={verifyingTextPasskey || textStep === "saving"}>
              {textStep === "saving" ? "Saving..." : verifyingTextPasskey ? "Checking..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
