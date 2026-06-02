import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { validatePasskey } from "@/lib/passkey";
import { Upload, FileUp, Lock, X, Eye, EyeOff, ClipboardType } from "lucide-react";

interface FileUploadProps {
  onUploadComplete: () => void;
}

interface PendingFile {
  file: File;
  displayName: string;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [passkey, setPasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [step, setStep] = useState<"select" | "passkey" | "name" | "uploading">("select");
  const [error, setError] = useState("");
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text snippet state
  const [textStep, setTextStep] = useState<"closed" | "compose" | "passkey" | "saving">("closed");
  const [textName, setTextName] = useState("");
  const [textBody, setTextBody] = useState("");
  const [textPasskey, setTextPasskey] = useState("");
  const [showTextPasskey, setShowTextPasskey] = useState(false);
  const [textError, setTextError] = useState("");
  const [verifyingTextPasskey, setVerifyingTextPasskey] = useState(false);

  const resetTextState = () => {
    setTextStep("closed");
    setTextName("");
    setTextBody("");
    setTextPasskey("");
    setShowTextPasskey(false);
    setTextError("");
    setVerifyingTextPasskey(false);
  };

  const handleTextNext = () => {
    if (!textName.trim()) { setTextError("Name is required"); return; }
    if (!textBody.trim()) { setTextError("Text content is required"); return; }
    setTextError("");
    setTextStep("passkey");
  };

  const handleTextSave = async () => {
    setVerifyingTextPasskey(true);
    if (!(await validatePasskey(textPasskey))) {
      setTextError("Invalid passkey");
      setVerifyingTextPasskey(false);
      return;
    }
    setVerifyingTextPasskey(false);
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
      setTextStep("passkey");
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setPending(
      arr.map((f) => ({ file: f, displayName: f.name.replace(/\.[^.]+$/, "") }))
    );
    setStep("passkey");
    setError("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handlePasskeySubmit = async () => {
    if (!passkey.trim()) {
      setError("Passkey is required");
      return;
    }
    setVerifyingPasskey(true);
    if (await validatePasskey(passkey)) {
      setStep("name");
      setError("");
    } else {
      setError("Invalid passkey. Try again.");
    }
    setVerifyingPasskey(false);
  };

  const handleUpload = async () => {
    if (pending.length === 0 || pending.some((p) => !p.displayName.trim())) {
      setError("All files need a display name");
      return;
    }
    setStep("uploading");
    setError("");
    setProgress({ done: 0, total: pending.length });

    try {
      for (let i = 0; i < pending.length; i++) {
        const { file, displayName } = pending[i];
        const filePath = `uploads/${Date.now()}_${i}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("user-files")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const fileExt = file.name.split(".").pop();
        const { error: dbError } = await supabase.from("files").insert({
          file_name: file.name,
          display_name: displayName.trim(),
          file_type: file.type || `application/${fileExt}`,
          file_size: file.size,
          storage_path: filePath,
        });
        if (dbError) throw dbError;
        setProgress({ done: i + 1, total: pending.length });
      }
      resetState();
      onUploadComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("name");
    }
  };

  const resetState = () => {
    setPending([]);
    setPasskey("");
    setShowPasskey(false);
    setStep("select");
    setError("");
    setVerifyingPasskey(false);
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
              {isDragging ? "Drop files here" : "Click or drag files to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Multiple files supported</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="mt-3">
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
              <p className="text-sm text-muted-foreground text-center">
                Uploading {progress.done} of {progress.total}...
              </p>
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
