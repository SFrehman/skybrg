import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Video, Square, Check, X, SwitchCamera } from "lucide-react";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onDone: (files: File[]) => void;
}

interface Captured {
  file: File;
  url: string;
  kind: "image" | "video";
}

export function CameraCapture({ open, onClose, onDone }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [preview, setPreview] = useState<{ idx: number; item: Captured } | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startStream = async (mode: "user" | "environment") => {
    setError("");
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to access camera");
    }
  };

  useEffect(() => {
    if (open) {
      void startStream(facing);
    } else {
      stopStream();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      setRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setElapsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  useEffect(() => {
    return () => {
      stopStream();
      captured.forEach((c) => URL.revokeObjectURL(c.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const ts = Date.now();
      const file = new File([blob], `photo_${ts}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setCaptured((prev) => [...prev, { file, url, kind: "image" }]);
    }, "image/jpeg", 0.92);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const type = rec.mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      const ts = Date.now();
      const file = new File([blob], `video_${ts}.${ext}`, { type });
      const url = URL.createObjectURL(blob);
      setCaptured((prev) => [...prev, { file, url, kind: "video" }]);
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const removeCaptured = (idx: number) => {
    setCaptured((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleDone = () => {
    if (captured.length === 0) return;
    const files = captured.map((c) => c.file);
    captured.forEach((c) => URL.revokeObjectURL(c.url));
    setCaptured([]);
    onDone(files);
  };

  const handleCancel = () => {
    if (recording) stopRecording();
    captured.forEach((c) => URL.revokeObjectURL(c.url));
    setCaptured([]);
    onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Camera
          </DialogTitle>
        </DialogHeader>
        <div className="relative bg-black aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
          {recording && (
            <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-xs font-medium text-destructive-foreground tabular-nums">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> REC {formatTime(elapsed)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="absolute top-2 right-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Switch camera"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="px-4 pt-2 text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-border">
          <Button type="button" variant="outline" onClick={takePhoto} disabled={recording || !!error} className="gap-2">
            <Camera className="h-4 w-4" /> Photo
          </Button>
          {recording ? (
            <Button type="button" variant="destructive" onClick={stopRecording} className="gap-2">
              <Square className="h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={startRecording} disabled={!!error} className="gap-2">
              <Video className="h-4 w-4" /> Record
            </Button>
          )}
        </div>
        {captured.length > 0 && (
          <div className="px-4 pb-3 max-h-32 overflow-y-auto">
            <div className="flex gap-2 flex-wrap">
              {captured.map((c, i) => (
                <div key={i} className="relative h-16 w-16 rounded-md overflow-hidden border border-border bg-muted">
                  <button
                    type="button"
                    onClick={() => setPreview({ idx: i, item: c })}
                    className="block h-full w-full"
                    aria-label="Preview"
                  >
                    {c.kind === "image" ? (
                      <img src={c.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black text-white">
                        <Video className="h-5 w-5" />
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCaptured(i)}
                    className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter className="px-4 pb-4">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleDone} disabled={captured.length === 0 || recording} className="gap-2">
            <Check className="h-4 w-4" /> Done ({captured.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
        </DialogHeader>
        {preview && (
          <div className="bg-black rounded-md overflow-hidden flex items-center justify-center">
            {preview.item.kind === "image" ? (
              <img src={preview.item.url} alt="" className="max-h-[60vh] w-auto" />
            ) : (
              <video src={preview.item.url} controls autoPlay className="max-h-[60vh] w-full" />
            )}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => {
              if (preview) removeCaptured(preview.idx);
              setPreview(null);
            }}
            className="gap-2"
          >
            <X className="h-4 w-4" /> Delete
          </Button>
          <Button onClick={() => setPreview(null)} className="gap-2">
            <Check className="h-4 w-4" /> Keep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}