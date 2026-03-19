import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, X, Type, Upload, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Play, Pause,
  Globe, Calendar, Lightbulb, FileSearch, ClipboardPaste, Zap
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Card, Button } from "@/components/ui-elements";

type InputMode = "file" | "text";
type StreamStatus = "idle" | "analyzing" | "completed" | "error";

interface KeyPoint { point: string; importance: "high" | "medium" | "low"; }
interface TimelineEvent { date: string; event: string; description: string; }
interface AnalysisResult {
  fileName: string;
  wordCount: number;
  shortSummary: string;
  detailedSummary: string;
  keyPoints: KeyPoint[];
  timeline: TimelineEvent[];
  documentType: string;
  mainTheme: string;
}

const LANGUAGES = [
  { code: "English",  label: "English",  flag: "🇬🇧" },
  { code: "Hindi",    label: "Hindi",    flag: "🇮🇳" },
  { code: "Marathi",  label: "Marathi",  flag: "🇮🇳" },
  { code: "Spanish",  label: "Spanish",  flag: "🇪🇸" },
  { code: "French",   label: "French",   flag: "🇫🇷" },
  { code: "German",   label: "German",   flag: "🇩🇪" },
  { code: "Arabic",   label: "Arabic",   flag: "🇸🇦" },
  { code: "Japanese", label: "Japanese", flag: "🇯🇵" },
  { code: "Chinese",  label: "Chinese",  flag: "🇨🇳" },
  { code: "Portuguese", label: "Portuguese", flag: "🇧🇷" },
];

const importanceBadge = (imp: string) => {
  if (imp === "high") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (imp === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-green-500/10 text-green-400 border-green-500/20";
};

export default function GeneralAnalyzer() {
  /* ── input state ── */
  const [mode, setMode]           = useState<InputMode>("file");
  const [file, setFile]           = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [docText, setDocText]     = useState("");
  const [docName, setDocName]     = useState("");
  const fileInputRef               = useRef<HTMLInputElement>(null);

  /* ── stream state ── */
  const [status, setStatus]       = useState<StreamStatus>("idle");
  const [progress, setProgress]   = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]         = useState("");
  const [result, setResult]       = useState<AnalysisResult | null>(null);

  /* ── result UI state ── */
  const [showDetailed, setShowDetailed]  = useState(false);
  const [selectedLang, setSelectedLang]  = useState("English");
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating]   = useState(false);

  /* ── TTS state ── */
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused]     = useState(false);
  const utteranceRef                 = useRef<SpeechSynthesisUtterance | null>(null);

  /* drag handlers */
  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  /* stop speech on unmount */
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  /* ── SSE consumer ── */
  async function consumeStream(response: Response) {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.replace("data: ", "").trim());
          if (event.type === "progress") {
            setProgress(event.progress ?? 0);
            setProgressMsg(event.message ?? "");
          } else if (event.type === "result") {
            setResult(event.data as AnalysisResult);
          } else if (event.type === "error") {
            setError(event.message ?? "Analysis failed.");
            setStatus("error");
            return;
          } else if (event.type === "done") {
            setStatus("completed");
            return;
          }
        } catch {}
      }
    }
  }

  /* ── analyze ── */
  const handleAnalyze = async () => {
    setStatus("analyzing"); setProgress(5); setProgressMsg("Starting…"); setError(""); setResult(null); setTranslatedText(null);

    try {
      let response: Response;
      if (mode === "file" && file) {
        const fd = new FormData();
        fd.append("file", file);
        response = await fetch("/api/general/analyze", { method: "POST", body: fd });
      } else {
        response = await fetch("/api/general/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: docText.trim(), documentName: docName.trim() || undefined }),
        });
      }
      if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
      await consumeStream(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection lost");
      setStatus("error");
    }
  };

  /* ── translate ── */
  const handleTranslate = async () => {
    if (!result || selectedLang === "English") return;
    setTranslating(true);
    try {
      const res = await fetch("/api/general/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.shortSummary, language: selectedLang }),
      });
      const data = await res.json() as { translatedText: string };
      setTranslatedText(data.translatedText);
    } catch { setTranslatedText("Translation failed. Please try again."); }
    finally { setTranslating(false); }
  };

  /* ── TTS ── */
  const handleSpeak = () => {
    if (!result) return;
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }
    window.speechSynthesis.cancel();
    const text = translatedText ?? result.shortSummary;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend   = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false); setIsPaused(false);
  };

  const canAnalyze = mode === "file" ? !!file : docText.trim().length >= 10;
  const isProcessing = status === "analyzing";

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 animate-fade-in pb-24">

      {/* ── Hero ── */}
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-sm font-medium mb-4">
          <Zap className="w-3.5 h-3.5" /> General Document Analyzer
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Understand <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Any Document</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload any PDF, Word, or text file — or just paste the content — and get instant summaries, key points, timelines, translations, and audio narration powered by AI.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "idle" || (status === "error" && !result) ? (
          <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">

            {/* Mode toggle */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Choose Input Method</h2>
              <div className="inline-flex p-1 bg-secondary/60 border border-white/8 rounded-xl gap-1">
                <button onClick={() => setMode("file")} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all", mode === "file" ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:text-white")}>
                  <Upload className="w-4 h-4" /> Upload File
                </button>
                <button onClick={() => setMode("text")} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all", mode === "text" ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:text-white")}>
                  <Type className="w-4 h-4" /> Paste Text
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode === "file" ? (
                <motion.div key="file" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card className={cn("border-2 border-dashed transition-all duration-300 group cursor-pointer", isDragging ? "border-violet-500 bg-violet-500/5" : "border-white/10 hover:border-white/20", file ? "border-white/20 bg-white/[0.02]" : "")}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    <div className="p-16 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8 text-violet-400" />
                      </div>
                      {file ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                            <FileText className="w-5 h-5 text-violet-400 shrink-0" />
                            <div className="text-left">
                              <p className="font-semibold text-white">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="ml-auto p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Ready to analyze. Click "Analyze Document" below.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xl font-semibold text-white mb-2">Drag & drop your file here</p>
                          <p className="text-sm text-muted-foreground mb-6">Supports PDF, DOC, DOCX, TXT — up to 50 MB</p>
                          <div className="relative">
                            <input ref={fileInputRef} type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx,.txt"
                              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                            <Button variant="secondary">Browse Files</Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="text" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  <input type="text" placeholder="Document name (optional)" value={docName} onChange={e => setDocName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 transition-colors" />
                  <div className="relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <ClipboardPaste className="w-3.5 h-3.5" /> Paste or Type Document Content
                    </label>
                    <textarea rows={14} placeholder={"Paste your document content here…\n\nAny type of document is supported: reports, contracts, articles, research papers, meeting notes, and more."} value={docText} onChange={e => setDocText(e.target.value)}
                      className="w-full px-4 py-3 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500 transition-colors resize-none leading-relaxed font-mono" />
                    <div className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg pointer-events-none">
                      {docText.trim() ? docText.trim().split(/\s+/).length : 0} words · {docText.length} chars
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {status === "error" && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}

            <div className="flex justify-center pt-2">
              <Button size="lg" className="w-full md:w-auto md:min-w-[280px] text-lg rounded-full bg-violet-600 hover:bg-violet-700 border-violet-500/30" disabled={!canAnalyze} onClick={handleAnalyze}>
                <FileSearch className="w-5 h-5 mr-2" /> Analyze Document
              </Button>
            </div>
          </motion.div>
        ) : isProcessing ? (
          /* ── Progress ── */
          <motion.div key="progress" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto mt-16">
            <Card className="p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[280px] bg-violet-500/15 blur-[80px] rounded-full pointer-events-none" />
              <div className="relative z-10 space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-card border border-white/10 flex items-center justify-center relative">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle strokeWidth="2" stroke="rgba(255,255,255,0.05)" fill="transparent" r="38" cx="40" cy="40" />
                    <circle className="text-violet-400 transition-all duration-300" strokeWidth="2"
                      strokeDasharray={240} strokeDashoffset={240 - (240 * progress) / 100}
                      strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="40" cy="40" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">Analyzing Document</h3>
                <p className="text-muted-foreground text-sm">{progressMsg}</p>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                    initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ ease: "easeOut", duration: 0.5 }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress}% complete</p>
              </div>
            </Card>
          </motion.div>
        ) : result ? (
          /* ── Results ── */
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* ── Result Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <h2 className="text-xl font-bold text-white">{result.fileName}</h2>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">{result.documentType}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">~{Number(result.wordCount).toLocaleString()} words</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{result.mainTheme}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setStatus("idle"); setResult(null); setFile(null); setDocText(""); setDocName(""); setTranslatedText(null); window.speechSynthesis?.cancel(); }}>
                <Upload className="w-4 h-4 mr-2" /> Analyze Another
              </Button>
            </div>

            {/* ── Summary ── */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-violet-400" />
                <h3 className="font-semibold text-white text-lg">Summary</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{result.shortSummary}</p>
              <button onClick={() => setShowDetailed(v => !v)} className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors mt-1">
                {showDetailed ? <><ChevronUp className="w-4 h-4" /> Hide detailed summary</> : <><ChevronDown className="w-4 h-4" /> Show detailed summary</>}
              </button>
              <AnimatePresence>
                {showDetailed && (
                  <motion.div key="detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <p className="text-muted-foreground leading-relaxed pt-2 border-t border-white/5">{result.detailedSummary}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ── Key Points ── */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white text-lg">Key Points</h3>
                <span className="ml-auto text-xs text-muted-foreground">{result.keyPoints.length} points</span>
              </div>
              <ul className="space-y-3">
                {result.keyPoints.map((kp, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-bold text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                    <p className="text-muted-foreground leading-relaxed flex-1">{kp.point}</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0", importanceBadge(kp.importance))}>
                      {kp.importance}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* ── Timeline ── */}
            {result.timeline.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-white text-lg">Timeline</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{result.timeline.length} events</span>
                </div>
                <div className="relative pl-8 space-y-6">
                  <div className="absolute left-3 top-1 bottom-1 w-px bg-gradient-to-b from-blue-500/50 via-blue-500/20 to-transparent" />
                  {result.timeline.map((ev, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-background shadow" />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-baseline gap-3">
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{ev.date}</span>
                          <span className="font-semibold text-white">{ev.event}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{ev.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Translation Panel ── */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white text-lg">Translation</h3>
              </div>
              <p className="text-xs text-muted-foreground">Translate the summary into another language using AI.</p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedLang}
                  onChange={e => { setSelectedLang(e.target.value); setTranslatedText(null); }}
                  className="px-3 py-2 bg-secondary border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" disabled={selectedLang === "English" || translating} onClick={handleTranslate}
                  className="border-green-500/30 hover:border-green-500 text-green-400 hover:text-green-300">
                  {translating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Translating…</> : "Translate"}
                </Button>
              </div>
              <AnimatePresence>
                {translatedText && (
                  <motion.div key="translation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                    <p className="text-xs text-green-400 font-medium mb-2 uppercase tracking-wide">{selectedLang}</p>
                    <p className="text-muted-foreground leading-relaxed">{translatedText}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ── Audio Player ── */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-white text-lg">Audio Narration</h3>
                <span className="ml-2 text-xs text-muted-foreground">
                  {translatedText ? `Speaking in ${selectedLang}` : "Speaking summary in English"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Listen to an AI narration of the {translatedText ? "translated" : ""} summary using your browser's built-in text-to-speech engine.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSpeak}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all",
                    isSpeaking && !isPaused
                      ? "bg-orange-500/20 border border-orange-500/40 text-orange-400"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  )}
                >
                  {isSpeaking && !isPaused ? <><Pause className="w-4 h-4" /> Pause</> : isPaused ? <><Play className="w-4 h-4" /> Resume</> : <><Play className="w-4 h-4" /> Play Summary</>}
                </button>
                {isSpeaking && (
                  <button onClick={handleStopSpeech} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-all">
                    <VolumeX className="w-4 h-4" /> Stop
                  </button>
                )}
                {isSpeaking && !isPaused && (
                  <div className="flex items-end gap-0.5 h-5">
                    {[3, 5, 7, 5, 4, 6, 3].map((h, i) => (
                      <div key={i} className="w-1 bg-orange-400 rounded-full animate-pulse" style={{ height: `${h * 3}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
