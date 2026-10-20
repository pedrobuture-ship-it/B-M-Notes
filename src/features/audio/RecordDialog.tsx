import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Dialog } from "@/components/Dialogs";
import { editorBridge } from "@/features/editor/editorBridge";
import { importAttachment } from "@/lib/images";
import { useTr } from "@/lib/i18n";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/** Records from the microphone and attaches the clip to the open note. Audio never leaves your computer. */
export function RecordDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const path = useUi((s) => s.activeNote);
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const release = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => release, []);

  const start = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error(tr("Recording is not available in this window."));
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = () => void save(r.mimeType || mime || "audio/webm");
      r.start(1000);
      rec.current = r;
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => setSeconds((n) => n + 1), 1000);
    } catch (e) {
      release();
      setError(e instanceof Error && e.name === "NotAllowedError" ? tr("Microphone access was denied.") : e instanceof Error ? e.message : String(e));
    }
  };

  const stop = () => {
    setState("saving");
    clearInterval(timer.current);
    rec.current?.stop();
  };

  const save = async (mime: string) => {
    release();
    if (!path) return;
    try {
      const blob = new Blob(chunks.current, { type: mime });
      const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
      const md = await importAttachment(path, new File([blob], `recording-${Date.now().toString(36)}.${ext}`, { type: mime.split(";")[0] }), `recording-${stamp().replace(/[ :]/g, "-")}.${ext}`);
      const text = md.replace(/^!\[\]/, `![${tr("Recording")} ${stamp()}]`);
      const st = editorBridge.state();
      if (st && editorBridge.replace(st.pos, st.pos, `\n${text}\n`)) {
        /* inserted at the cursor */
      } else {
        const ws = useWorkspace.getState();
        const cur = ws.notes[path]?.content ?? "";
        ws.setContent(path, `${cur}${cur.endsWith("\n") || !cur ? "" : "\n"}\n${text}\n`);
      }
      useUi.getState().toast(tr("Recording attached"), "success");
      setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  };

  return (
    <Dialog title={tr("Record audio")} onClose={() => { if (state === "recording") rec.current?.stop(); release(); setDialog(null); }} width={420} center>
      <div className="px-5 pb-5 flex flex-col items-center gap-3">
        {!path && <p>{tr("Open a note first.")}</p>}
        <div className="handwritten-label" style={{ fontSize: "2.4rem" }} aria-live="polite">{fmt(seconds)}</div>
        {state === "idle" && <button className="btn btn-primary" disabled={!path} onClick={() => void start()}><Mic size={16} /> {tr("Start recording")}</button>}
        {state === "recording" && <button className="btn btn-danger" onClick={stop}><Square size={16} /> {tr("Stop and attach")}</button>}
        {state === "saving" && <small>{tr("Saving…")}</small>}
        {error && <p role="alert" style={{ color: "var(--red)", fontWeight: 700, margin: 0 }}>{error}</p>}
        <small style={{ color: "var(--ink-faint)", textAlign: "center" }}>{tr("The clip is saved in your assets folder and added to the note as a player.")}</small>
      </div>
    </Dialog>
  );
}
