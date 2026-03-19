import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, X, Type, Upload, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Play, Pause,
  Globe, Calendar, Lightbulb, FileSearch, ClipboardPaste, Zap,
  BookOpen, Code2, Target, FlaskConical, ListChecks, MessageSquare, Cpu,
  TriangleAlert, Wrench, Info
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Card, Button } from "@/components/ui-elements";

type InputMode = "file" | "text";
type StreamStatus = "idle" | "analyzing" | "completed" | "error";

interface KeyPoint { point: string; importance: "high" | "medium" | "low"; }
interface TimelineEvent { date: string; event: string; description: string; }
interface CodeAnalysis {
  language: string; snippet: string; functionality: string;
  errors: string[]; algorithms: string[]; explanation: string; suggestions: string[];
}
interface AcademicStructure {
  objectives: string[]; methodology: string; requirements: string[];
  observations: string[]; conclusions: string[];
}
interface AnalysisResult {
  fileName: string; wordCount: number; shortSummary: string; detailedSummary: string;
  keyPoints: KeyPoint[]; timeline: TimelineEvent[];
  documentType: string; mainTheme: string;
  category?: string; coverageNote?: string;
  academicStructure?: AcademicStructure | null;
  codeAnalysis?: CodeAnalysis[];
}

const LANGUAGES = [
  { code: "English", label: "English", flag: "🇬🇧" },
  { code: "Hindi", label: "Hindi", flag: "🇮🇳" },
  { code: "Marathi", label: "Marathi", flag: "🇮🇳" },
  { code: "Spanish", label: "Spanish", flag: "🇪🇸" },
  { code: "French", label: "French", flag: "🇫🇷" },
  { code: "German", label: "German", flag: "🇩🇪" },
  { code: "Arabic", label: "Arabic", flag: "🇸🇦" },
  { code: "Japanese", label: "Japanese", flag: "🇯🇵" },
  { code: "Chinese", label: "Chinese", flag: "🇨🇳" },
  { code: "Portuguese", label: "Portuguese", flag: "🇧🇷" },
];

const importanceBadge = (imp: string) =>
  imp === "high" ? "bg-red-500/10 text-red-400 border-red-500/20" :
  imp === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
  "bg-green-500/10 text-green-400 border-green-500/20";

const categoryLabel: Record<string, { label: string; color: string }> = {
  "academic":        { label: "Academic / Research",      color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "technical-code":  { label: "Technical + Code",          color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  "technical":       { label: "Technical Document",        color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  "general":         { label: "General Document",          color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

function Section({ icon: Icon, title, iconColor, children, defaultOpen = true }: {
  icon: React.ElementType; title: string; iconColor: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-0 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors text-left">
        <div className="flex items-center gap-3">
          <Icon className={cn("w-5 h-5", iconColor)} />
          <h3 className="font-semibold text-white text-base">{title}</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-6 pb-6 pt-0 border-t border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function GeneralAnalyzer() {
  const [mode, setMode]             = useState<InputMode>("file");
  const [file, setFile]             = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [docText, setDocText]       = useState("");
  const [docName, setDocName]       = useState("");
  const fileInputRef                 = useRef<HTMLInputElement>(null);

  const [status, setStatus]         = useState<StreamStatus>("idle");
  const [progress, setProgress]     = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]           = useState("");
  const [result, setResult]         = useState<AnalysisResult | null>(null);

  const [showDetailed, setShowDetailed]     = useState(false);
  const [selectedLang, setSelectedLang]     = useState("English");
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating]       = useState(false);
  const [expandedCode, setExpandedCode]     = useState<Set<number>>(new Set());

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused]     = useState(false);
  const utteranceRef                 = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0]; if (f) setFile(f);
  }, []);

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
          if (event.type === "progress") { setProgress(event.progress ?? 0); setProgressMsg(event.message ?? ""); }
          else if (event.type === "result") { setResult(event.data as AnalysisResult); }
          else if (event.type === "error") { setError(event.message ?? "Analysis failed."); setStatus("error"); return; }
          else if (event.type === "done")  { setStatus("completed"); return; }
        } catch {}
      }
    }
  }

  const handleAnalyze = async () => {
    setStatus("analyzing"); setProgress(5); setProgressMsg("Starting…");
    setError(""); setResult(null); setTranslatedText(null); setExpandedCode(new Set());
    try {
      let response: Response;
      if (mode === "file" && file) {
        const fd = new FormData(); fd.append("file", file);
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

  const handleSpeak = () => {
    if (!result) return;
    if (isSpeaking && !isPaused) { window.speechSynthesis.pause(); setIsPaused(true); return; }
    if (isPaused) { window.speechSynthesis.resume(); setIsPaused(false); return; }
    window.speechSynthesis.cancel();
    const text = translatedText ?? result.shortSummary;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; utterance.pitch = 1;
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend   = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeech = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); setIsPaused(false); };

  const toggleCode = (i: number) => setExpandedCode(prev => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s;
  });

  const reset = () => {
    setStatus("idle"); setResult(null); setFile(null); setDocText(""); setDocName(""); setTranslatedText(null);
    window.speechSynthesis?.cancel(); setIsSpeaking(false); setIsPaused(false);
  };

  const canAnalyze = mode === "file" ? !!file : docText.trim().length >= 10;
  const catInfo = result?.category ? (categoryLabel[result.category] ?? categoryLabel["general"]) : null;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 animate-fade-in pb-24">

      {/* Hero */}
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-sm font-medium mb-4">
          <Zap className="w-3.5 h-3.5" /> General Document Analyzer
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Understand <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Any Document</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Deep, line-by-line AI analysis of any PDF, Word, or text file. Covers all sections, code, tables, academic structure, timelines, and more.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground pt-1">
          {["Full Coverage", "Code Analysis", "Academic Docs", "10+ Languages", "Audio Narration", "Large Docs"].map(f => (
            <span key={f} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/8">
              <span className="w-1 h-1 rounded-full bg-violet-400" />{f}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === "idle" || (status === "error" && !result) ? (
          <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
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
                            <button onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                              className="ml-auto p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Ready to analyze. Click "Deep Analyze" below.</p>
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
                    <textarea rows={14} placeholder={"Paste document text here…\n\nSupports any type: research papers, lab manuals, technical reports, project guidelines, code files, articles, and more."} value={docText} onChange={e => setDocText(e.target.value)}
                      className="w-full px-4 py-3 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500 transition-colors resize-none leading-relaxed font-mono" />
                    <div className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg pointer-events-none">
                      {docText.trim() ? docText.trim().split(/\s+/).length : 0} words · {docText.length} chars
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {status === "error" && <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}

            <div className="flex justify-center pt-2">
              <Button size="lg" className="w-full md:w-auto md:min-w-[280px] text-lg rounded-full bg-violet-600 hover:bg-violet-700 border-violet-500/30"
                disabled={!canAnalyze} onClick={handleAnalyze}>
                <FileSearch className="w-5 h-5 mr-2" /> Deep Analyze
              </Button>
            </div>
          </motion.div>

        ) : status === "analyzing" ? (
          /* ── Progress ── */
          <motion.div key="progress" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto mt-16">
            <Card className="p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[280px] bg-violet-500/15 blur-[80px] rounded-full pointer-events-none" />
              <div className="relative z-10 space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-card border border-white/10 flex items-center justify-center relative">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle strokeWidth="2" stroke="rgba(255,255,255,0.05)" fill="transparent" r="38" cx="40" cy="40" />
                    <circle className="text-violet-400 transition-all duration-500" strokeWidth="2"
                      strokeDasharray={240} strokeDashoffset={240 - (240 * progress) / 100}
                      strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="40" cy="40" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Deep Analysis Running</h3>
                  <p className="text-muted-foreground text-sm mt-1">{progressMsg}</p>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                    initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ ease: "easeOut", duration: 0.5 }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress}% complete — reading every section thoroughly</p>
              </div>
            </Card>
          </motion.div>

        ) : result ? (
          /* ── Results ── */
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-2">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <h2 className="text-xl font-bold text-white">{result.fileName}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{result.documentType}</span>
                  {catInfo && <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", catInfo.color)}>{catInfo.label}</span>}
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                    ~{Number(result.wordCount).toLocaleString()} words
                  </span>
                  {result.codeAnalysis && result.codeAnalysis.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center gap-1">
                      <Code2 className="w-3 h-3" /> {result.codeAnalysis.length} code block{result.codeAnalysis.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{result.mainTheme}</p>
                {result.coverageNote && (
                  <p className="text-xs text-blue-400/80 flex items-center gap-1.5 mt-1">
                    <Info className="w-3 h-3" />{result.coverageNote}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={reset}><Upload className="w-4 h-4 mr-2" />Analyze Another</Button>
            </div>

            {/* Summary */}
            <Section icon={FileText} title="Document Summary" iconColor="text-violet-400">
              <p className="text-muted-foreground leading-relaxed mt-4">{result.shortSummary}</p>
              <button onClick={() => setShowDetailed(v => !v)} className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors mt-4">
                {showDetailed ? <><ChevronUp className="w-4 h-4" />Hide detailed summary</> : <><ChevronDown className="w-4 h-4" />Show detailed summary</>}
              </button>
              <AnimatePresence>
                {showDetailed && (
                  <motion.div key="detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <p className="text-muted-foreground leading-relaxed pt-4 border-t border-white/5 mt-4 whitespace-pre-wrap">{result.detailedSummary}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            {/* Key Points */}
            <Section icon={Lightbulb} title={`Key Points (${result.keyPoints.length})`} iconColor="text-yellow-400">
              <ul className="space-y-3 mt-4">
                {result.keyPoints.map((kp, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-bold text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                    <p className="text-muted-foreground leading-relaxed flex-1">{kp.point}</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 capitalize", importanceBadge(kp.importance))}>
                      {kp.importance}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Academic Structure */}
            {result.academicStructure && (
              <Section icon={BookOpen} title="Academic / Technical Structure" iconColor="text-blue-400">
                <div className="space-y-6 mt-4">
                  {result.academicStructure.objectives?.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                        <Target className="w-4 h-4 text-green-400" /> Objectives
                      </h4>
                      <ul className="space-y-2">
                        {result.academicStructure.objectives.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.academicStructure.methodology && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                        <FlaskConical className="w-4 h-4 text-blue-400" /> Methodology / Procedure
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{result.academicStructure.methodology}</p>
                    </div>
                  )}
                  {result.academicStructure.requirements?.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                        <ListChecks className="w-4 h-4 text-yellow-400" /> Requirements / Materials
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.academicStructure.requirements.map((r, i) => (
                          <span key={i} className="text-xs px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.academicStructure.observations?.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                        <MessageSquare className="w-4 h-4 text-cyan-400" /> Observations / Results
                      </h4>
                      <ul className="space-y-2">
                        {result.academicStructure.observations.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />{o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.academicStructure.conclusions?.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                        <CheckCircle2 className="w-4 h-4 text-violet-400" /> Conclusions / Findings
                      </h4>
                      <ul className="space-y-2">
                        {result.academicStructure.conclusions.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Code Analysis */}
            {result.codeAnalysis && result.codeAnalysis.length > 0 && (
              <Section icon={Code2} title={`Code Analysis (${result.codeAnalysis.length} block${result.codeAnalysis.length > 1 ? "s" : ""})`} iconColor="text-orange-400">
                <div className="space-y-4 mt-4">
                  {result.codeAnalysis.map((ca, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                      <button onClick={() => toggleCode(i)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <Cpu className="w-4 h-4 text-orange-400" />
                          <span className="text-sm font-semibold text-white">Code Block {i + 1}</span>
                          {ca.language && ca.language !== "unknown" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono uppercase">
                              {ca.language}
                            </span>
                          )}
                        </div>
                        {expandedCode.has(i) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>

                      <AnimatePresence>
                        {expandedCode.has(i) && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-white/5">
                            <div className="p-4 space-y-4">
                              {ca.snippet && (
                                <pre className="text-xs font-mono bg-black/40 border border-white/8 p-3 rounded-lg overflow-x-auto text-green-300/80 leading-relaxed">
                                  {ca.snippet}
                                </pre>
                              )}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Functionality</p>
                                <p className="text-sm text-muted-foreground">{ca.functionality}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Plain-English Explanation</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{ca.explanation}</p>
                              </div>
                              {ca.algorithms?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Algorithms / Patterns</p>
                                  <div className="flex flex-wrap gap-2">
                                    {ca.algorithms.map((a, j) => (
                                      <span key={j} className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">{a}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {ca.errors?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1.5">
                                    <TriangleAlert className="w-3.5 h-3.5" /> Issues / Inefficiencies
                                  </p>
                                  <ul className="space-y-1.5">
                                    {ca.errors.map((e, j) => (
                                      <li key={j} className="flex items-start gap-2 text-sm text-red-400/80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />{e}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {ca.suggestions?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-2 flex items-center gap-1.5">
                                    <Wrench className="w-3.5 h-3.5" /> Improvement Suggestions
                                  </p>
                                  <ul className="space-y-1.5">
                                    {ca.suggestions.map((s, j) => (
                                      <li key={j} className="flex items-start gap-2 text-sm text-green-400/80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />{s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Timeline */}
            {result.timeline.length > 0 && (
              <Section icon={Calendar} title={`Timeline (${result.timeline.length} events)`} iconColor="text-blue-400">
                <div className="relative pl-8 space-y-6 mt-4">
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
              </Section>
            )}

            {/* Translation */}
            <Section icon={Globe} title="Translation" iconColor="text-green-400" defaultOpen={false}>
              <div className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">Translate the document summary using AI — preserving meaning and technical terminology.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={selectedLang} onChange={e => { setSelectedLang(e.target.value); setTranslatedText(null); }}
                    className="px-3 py-2 bg-secondary border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-green-500 transition-colors">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
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
              </div>
            </Section>

            {/* Audio */}
            <Section icon={Volume2} title="Audio Narration" iconColor="text-orange-400" defaultOpen={false}>
              <div className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">
                  Listen to an AI narration of the {translatedText ? `${selectedLang} translation` : "summary"} using your browser's text-to-speech engine.
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={handleSpeak} className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all",
                    isSpeaking && !isPaused ? "bg-orange-500/20 border border-orange-500/40 text-orange-400" : "bg-orange-500 text-white hover:bg-orange-600"
                  )}>
                    {isSpeaking && !isPaused ? <><Pause className="w-4 h-4" />Pause</> : isPaused ? <><Play className="w-4 h-4" />Resume</> : <><Play className="w-4 h-4" />Play Summary</>}
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
              </div>
            </Section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
