import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileUp, Lock } from "lucide-react";

interface FileUploadProps {
  onUploadComplete: () => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [passkey, setPasskey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState<"select" | "passkey" | "name" | "uploading">("select");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setStep("passkey");
      setError("");
    }
  };

  const handlePasskeySubmit = () => {
    if (passkey === "Saif_Jani") {
      setStep("name");
      setDisplayName(file?.name.split(".")[0] || "");
      setError("");
    } else {
      setError("Invalid passkey. Try again.");
    }
  };

  const handleUpload = async () => {
    if (!file || !displayName.trim()) return;
    setStep("uploading");
    setError("");

    try {
      const filePath = `uploads/${Date.now()}_${file.name}`;

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

      resetState();
      onUploadComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("name");
    }
  };

  const resetState = () => {
    setFile(null);
    setPasskey("");
    setDisplayName("");
    setStep("select");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Card className="border-dashed border-2 border-border hover:border-primary/40 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Upload File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center py-8 cursor-pointer rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Click to select a file</p>
            <p className="text-xs text-muted-foreground mt-1">Images, videos, PDFs, or any file</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
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
            <Label>Passkey to upload</Label>
            <Input
              type="password"
              placeholder="Enter passkey"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasskeySubmit()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetState}>Cancel</Button>
            <Button onClick={handlePasskeySubmit}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "name" || step === "uploading"} onOpenChange={(open) => !open && step !== "uploading" && resetState()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name Your File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Display name</Label>
            <Input
              placeholder="My awesome file"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpload()}
              disabled={step === "uploading"}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                Original: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetState} disabled={step === "uploading"}>Cancel</Button>
            <Button onClick={handleUpload} disabled={step === "uploading" || !displayName.trim()}>
              {step === "uploading" ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
