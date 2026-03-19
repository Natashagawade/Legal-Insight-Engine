import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, X, Type, Upload, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Play, Pause,
  Globe, Lightbulb, ClipboardPaste, GraduationCap, BookOpen,
  ListChecks, HelpCircle, Star, Brain, Target, Clock
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Card, Button } from "@/components/ui-elements";

type InputMode = "file" | "text";
type AnalysisMode = "explain" | "syllabus";
type StreamStatus = "idle" | "analyzing" | "completed" | "error";

interface KeyPoint { point: string; importance: "high" | "medium" | "low"; simpleExplanation: string; }
interface Concept { name: string; definition: string; example: string; importance: string; }
interface StepItem { step: number; title: string; explanation: string; tip: string; }
interface IQ { question: string; answer?: string; topic: string; difficulty: "easy" | "medium" | "hard"; type?: string; }
interface Topic { name: string; subtopics: string[]; importance: string; estimatedHours?: number; }
interface StudyPlan { week: number; focus: string; goal: string; }

interface AnalysisResult {
  fileName: string; wordCount: number; mode: AnalysisMode;
  shortSummary: string; subject: string; detailedExplanation?: string;
  keyPoints?: KeyPoint[]; concepts?: Concept[]; stepByStep?: StepItem[];
  importantQuestions: IQ[]; examTips: string[]; memorableFacts?: string[];
  difficultyLevel: string; relatedTopics?: string[];
  topics?: Topic[]; totalTopics?: number;
  keyFormulas?: string[]; studyPlan?: StudyPlan[];
}

const LANGUAGES = [
  { code: "English", label: "English", flag: "🇬🇧" },
  { code: "Hindi", label: "Hindi", flag: "🇮🇳" },
  { code: "Marathi", label: "Marathi", flag: "🇮🇳" },
  { code: "Spanish", label: "Spanish", flag: "🇪🇸" },
  { code: "French", label: "French", flag: "🇫🇷" },
  { code: "German", label: "German", flag: "🇩🇪" },
  { code: "Japanese", label: "Japanese", flag: "🇯🇵" },
  { code: "Chinese", label: "Chinese", flag: "🇨🇳" },
];

const difficultyColors: Record<string, string> = {
  beginner:     "bg-green-500/10 border-green-500/20 text-green-400",
  intermediate: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  advanced:     "bg-red-500/10 border-red-500/20 text-red-400",
};

const difficultyBadge = (d: string) =>
  d === "hard" ? "bg-red-500/10 text-red-400 border-red-500/20" :
  d === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
  "bg-green-500/10 text-green-400 border-green-500/20";

function Section({ icon: Icon, iconColor, title, count, children, defaultOpen = true }: {
  icon: React.ElementType; iconColor: string; title: string; count?: number;
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
          {count !== undefined && <span className="text-xs text-muted-foreground ml-1">({count})</span>}
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

export default function AcademicAssistant() {
  const [mode, setMode]               = useState<InputMode>("file");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("explain");
  const [file, setFile]               = useState<File | null>(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [docText, setDocText]         = useState("");
  const [docName, setDocName]         = useState("");
  const fileInputRef                   = useRef<HTMLInputElement>(null);

  const [status, setStatus]           = useState<StreamStatus>("idle");
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]             = useState("");
  const [result, setResult]           = useState<AnalysisResult | null>(null);

  const [selectedLang, setSelectedLang]     = useState("English");
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating]       = useState(false);
  const [showAnswers, setShowAnswers]       = useState<Set<number>>(new Set());

  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isPaused, setIsPaused]       = useState(false);
  const [speechRate, setSpeechRate]   = useState(0.9);

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
          else if (event.type === "result") setResult(event.data as AnalysisResult);
          else if (event.type === "error") { setError(event.message ?? "Failed"); setStatus("error"); return; }
          else if (event.type === "done")  { setStatus("completed"); return; }
        } catch {}
      }
    }
  }

  const handleAnalyze = async () => {
    setStatus("analyzing"); setProgress(5); setProgressMsg("Starting…");
    setError(""); setResult(null); setTranslatedText(null); setShowAnswers(new Set());
    try {
      let response: Response;
      if (mode === "file" && file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("mode", analysisMode);
        response = await fetch("/api/academic/analyze", { method: "POST", body: fd });
      } else {
        response = await fetch("/api/academic/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: docText.trim(), documentName: docName.trim() || undefined, mode: analysisMode }),
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
      const textToTranslate = result.detailedExplanation ?? result.shortSummary;
      const res = await fetch("/api/general/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToTranslate, language: selectedLang }),
      });
      const data = await res.json() as { translatedText: string };
      setTranslatedText(data.translatedText);
    } catch { setTranslatedText("Translation failed."); }
    finally { setTranslating(false); }
  };

  const handleSpeak = () => {
    if (!result) return;
    if (isSpeaking && !isPaused) { window.speechSynthesis.pause(); setIsPaused(true); return; }
    if (isPaused) { window.speechSynthesis.resume(); setIsPaused(false); return; }
    window.speechSynthesis.cancel();
    const text = translatedText ?? result.detailedExplanation ?? result.shortSummary;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate; utterance.pitch = 1;
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend   = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    window.speechSynthesis.speak(utterance);
  };

  const toggleAnswer = (i: number) => setShowAnswers(prev => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s;
  });

  const reset = () => {
    setStatus("idle"); setResult(null); setFile(null); setDocText(""); setDocName(""); setTranslatedText(null);
    window.speechSynthesis?.cancel(); setIsSpeaking(false); setIsPaused(false);
  };

  const canAnalyze = mode === "file" ? !!file : docText.trim().length >= 10;
  const importanceColor = (imp: string) =>
    imp === "high" ? "bg-red-500/10 text-red-400 border-red-500/20" :
    imp === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
    "bg-green-500/10 text-green-400 border-green-500/20";

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 animate-fade-in pb-24">

      {/* Hero */}
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium mb-4">
          <GraduationCap className="w-3.5 h-3.5" /> Academic Assistant
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Your Personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400">AI Tutor</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload notes, lab manuals, or a syllabus — your AI tutor breaks everything down in simple language, generates exam questions, and creates study plans.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "idle" || (status === "error" && !result) ? (
          <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">

            {/* Analysis mode */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">What would you like to do?</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <button onClick={() => setAnalysisMode("explain")} className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                  analysisMode === "explain" ? "border-green-500/50 bg-green-500/5 ring-1 ring-green-500/30" : "border-white/8 hover:border-white/20"
                )}>
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", analysisMode === "explain" ? "bg-green-500/20" : "bg-white/5")}>
                    <Brain className={cn("w-5 h-5", analysisMode === "explain" ? "text-green-400" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Explain & Understand</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload notes, lab manuals, or any study material. AI explains concepts step-by-step in simple language.</p>
                  </div>
                </button>
                <button onClick={() => setAnalysisMode("syllabus")} className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                  analysisMode === "syllabus" ? "border-teal-500/50 bg-teal-500/5 ring-1 ring-teal-500/30" : "border-white/8 hover:border-white/20"
                )}>
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", analysisMode === "syllabus" ? "bg-teal-500/20" : "bg-white/5")}>
                    <BookOpen className={cn("w-5 h-5", analysisMode === "syllabus" ? "text-teal-400" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Syllabus Analyzer</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload your course syllabus. AI generates important questions, topic breakdown, and a study plan.</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Input mode */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Choose Input Method</h2>
              <div className="inline-flex p-1 bg-secondary/60 border border-white/8 rounded-xl gap-1">
                <button onClick={() => setMode("file")} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all", mode === "file" ? "bg-green-600 text-white shadow" : "text-muted-foreground hover:text-white")}>
                  <Upload className="w-4 h-4" /> Upload File
                </button>
                <button onClick={() => setMode("text")} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all", mode === "text" ? "bg-green-600 text-white shadow" : "text-muted-foreground hover:text-white")}>
                  <Type className="w-4 h-4" /> Paste Text
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode === "file" ? (
                <motion.div key="file" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card className={cn("border-2 border-dashed transition-all duration-300 cursor-pointer", isDragging ? "border-green-500 bg-green-500/5" : "border-white/10 hover:border-white/20", file ? "border-white/20" : "")}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    <div className="p-16 flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6">
                        <UploadCloud className="w-8 h-8 text-green-400" />
                      </div>
                      {file ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <FileText className="w-5 h-5 text-green-400 shrink-0" />
                            <div className="text-left">
                              <p className="font-semibold text-white">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            </div>
                            <button onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                              className="ml-auto p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Ready! Click "Start Learning" below.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xl font-semibold text-white mb-2">Drop your study material here</p>
                          <p className="text-sm text-muted-foreground mb-6">
                            {analysisMode === "syllabus" ? "Upload your syllabus PDF, DOC, or TXT file" : "Notes, lab manuals, project guides, PDFs, Word docs, or TXT"}
                          </p>
                          <div className="relative">
                            <input ref={fileInputRef} type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.doc,.docx,.txt"
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
                  <input type="text" placeholder={analysisMode === "syllabus" ? "Subject / course name (optional)" : "Document name (optional)"}
                    value={docName} onChange={e => setDocName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-green-500 transition-colors" />
                  <div className="relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      {analysisMode === "syllabus" ? "Paste Syllabus Content" : "Paste Study Material / Notes"}
                    </label>
                    <textarea rows={14}
                      placeholder={analysisMode === "syllabus"
                        ? "Paste your syllabus or course outline here…\n\nInclude topics, units, chapters, and any learning objectives."
                        : "Paste your notes, textbook content, lab manual, or study material here…\n\nYour AI tutor will explain everything in simple language and generate practice questions."}
                      value={docText} onChange={e => setDocText(e.target.value)}
                      className="w-full px-4 py-3 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-green-500 transition-colors resize-none font-mono leading-relaxed" />
                    <div className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg pointer-events-none">
                      {docText.trim() ? docText.trim().split(/\s+/).length : 0} words
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {status === "error" && <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}

            <div className="flex justify-center pt-2">
              <Button size="lg" className="w-full md:w-auto md:min-w-[280px] text-lg rounded-full bg-green-600 hover:bg-green-700 border-green-500/30"
                disabled={!canAnalyze} onClick={handleAnalyze}>
                <GraduationCap className="w-5 h-5 mr-2" />
                {analysisMode === "syllabus" ? "Analyze Syllabus" : "Start Learning"}
              </Button>
            </div>
          </motion.div>

        ) : status === "analyzing" ? (
          <motion.div key="progress" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto mt-16">
            <Card className="p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[280px] bg-green-500/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="relative z-10 space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-card border border-white/10 flex items-center justify-center relative">
                  <GraduationCap className="w-8 h-8 text-green-400" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle strokeWidth="2" stroke="rgba(255,255,255,0.05)" fill="transparent" r="38" cx="40" cy="40" />
                    <circle className="text-green-400 transition-all duration-500" strokeWidth="2"
                      strokeDasharray={240} strokeDashoffset={240 - (240 * progress) / 100}
                      strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="40" cy="40" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">AI Tutor is Reading…</h3>
                <p className="text-muted-foreground text-sm">{progressMsg}</p>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-green-500 to-teal-500"
                    initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ ease: "easeOut", duration: 0.5 }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress}% — preparing your study material</p>
              </div>
            </Card>
          </motion.div>

        ) : result ? (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-2">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <h2 className="text-xl font-bold text-white">{result.fileName}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-medium">
                    {result.mode === "syllabus" ? "Syllabus Analysis" : "Study Material"}
                  </span>
                  {result.subject && <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{result.subject}</span>}
                  {result.difficultyLevel && (
                    <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium capitalize", difficultyColors[result.difficultyLevel] ?? difficultyColors.intermediate)}>
                      {result.difficultyLevel}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                    ~{Number(result.wordCount).toLocaleString()} words
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={reset}><Upload className="w-4 h-4 mr-2" />New Analysis</Button>
            </div>

            {/* Summary */}
            <Section icon={FileText} iconColor="text-green-400" title="Overview">
              <p className="text-muted-foreground leading-relaxed mt-4">{result.shortSummary}</p>
            </Section>

            {/* Detailed Explanation (explain mode only) */}
            {result.mode === "explain" && result.detailedExplanation && (
              <Section icon={Brain} iconColor="text-blue-400" title="Full Explanation" defaultOpen={false}>
                <p className="text-muted-foreground leading-relaxed mt-4 whitespace-pre-wrap">{result.detailedExplanation}</p>
              </Section>
            )}

            {/* Key Points */}
            {result.keyPoints && result.keyPoints.length > 0 && (
              <Section icon={Lightbulb} iconColor="text-yellow-400" title="Key Points" count={result.keyPoints.length}>
                <ul className="space-y-4 mt-4">
                  {result.keyPoints.map((kp, i) => (
                    <li key={i} className="space-y-1">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 text-right mt-0.5">{i + 1}.</span>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{kp.point}</p>
                          {kp.simpleExplanation && <p className="text-xs text-muted-foreground mt-0.5">{kp.simpleExplanation}</p>}
                        </div>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 capitalize", importanceColor(kp.importance))}>
                          {kp.importance}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Concepts */}
            {result.concepts && result.concepts.length > 0 && (
              <Section icon={BookOpen} iconColor="text-violet-400" title="Concepts Explained" count={result.concepts.length} defaultOpen={false}>
                <div className="space-y-4 mt-4">
                  {result.concepts.map((c, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
                      <h4 className="font-semibold text-white text-sm">{c.name}</h4>
                      <p className="text-sm text-muted-foreground"><span className="text-white/50 font-medium">Definition: </span>{c.definition}</p>
                      {c.example && <p className="text-sm text-muted-foreground"><span className="text-white/50 font-medium">Example: </span>{c.example}</p>}
                      {c.importance && <p className="text-xs text-muted-foreground/70 italic">{c.importance}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Step by Step */}
            {result.stepByStep && result.stepByStep.length > 0 && (
              <Section icon={ListChecks} iconColor="text-cyan-400" title="Step-by-Step Guide" count={result.stepByStep.length}>
                <div className="space-y-4 mt-4 relative pl-8">
                  <div className="absolute left-3 top-1 bottom-1 w-px bg-gradient-to-b from-cyan-500/50 to-transparent" />
                  {result.stepByStep.map((s, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-5 top-1.5 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-background">{s.step}</div>
                      <div className="space-y-1">
                        <p className="font-semibold text-white text-sm">{s.title}</p>
                        <p className="text-sm text-muted-foreground">{s.explanation}</p>
                        {s.tip && <p className="text-xs text-cyan-400/80 flex items-center gap-1"><Star className="w-3 h-3" />{s.tip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Syllabus Topics */}
            {result.topics && result.topics.length > 0 && (
              <Section icon={BookOpen} iconColor="text-teal-400" title={`Topics Breakdown (${result.totalTopics ?? result.topics.length})`}>
                <div className="space-y-3 mt-4">
                  {result.topics.map((t, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-semibold text-white text-sm">{t.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.estimatedHours && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />{t.estimatedHours}h
                            </span>
                          )}
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize", importanceColor(t.importance))}>{t.importance}</span>
                        </div>
                      </div>
                      {t.subtopics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.subtopics.map((s, j) => (
                            <span key={j} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Study Plan */}
            {result.studyPlan && result.studyPlan.length > 0 && (
              <Section icon={Target} iconColor="text-orange-400" title="Study Plan" defaultOpen={false}>
                <div className="space-y-3 mt-4">
                  {result.studyPlan.map((w, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center shrink-0 text-center">
                        <span className="text-[9px] text-orange-400/70 uppercase font-bold">Week</span>
                        <span className="text-xl font-extrabold text-orange-400">{w.week}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{w.focus}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.goal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Key Formulas */}
            {result.keyFormulas && result.keyFormulas.length > 0 && (
              <Section icon={Star} iconColor="text-yellow-400" title="Key Formulas & Theorems" defaultOpen={false}>
                <ul className="space-y-2 mt-4">
                  {result.keyFormulas.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Important Questions */}
            {result.importantQuestions.length > 0 && (
              <Section icon={HelpCircle} iconColor="text-pink-400" title="Important Questions" count={result.importantQuestions.length}>
                <div className="space-y-3 mt-4">
                  {result.importantQuestions.map((q, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                      <button onClick={() => toggleAnswer(i)} className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 mt-0.5 text-right">{i + 1}.</span>
                          <p className="text-sm text-white">{q.question}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize", difficultyBadge(q.difficulty))}>{q.difficulty}</span>
                          {q.type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground capitalize">{q.type}</span>}
                          {q.answer && (showAnswers.has(i) ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />)}
                        </div>
                      </button>
                      <AnimatePresence>
                        {showAnswers.has(i) && q.answer && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/5">
                            <div className="px-4 py-3 bg-green-500/3">
                              <p className="text-xs font-semibold text-green-400 mb-1 uppercase tracking-wide">Answer</p>
                              <p className="text-sm text-muted-foreground">{q.answer}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Exam Tips */}
            {result.examTips.length > 0 && (
              <Section icon={Star} iconColor="text-orange-400" title="Exam Tips" count={result.examTips.length} defaultOpen={false}>
                <ul className="space-y-3 mt-4">
                  {result.examTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{tip}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Related Topics */}
            {result.relatedTopics && result.relatedTopics.length > 0 && (
              <Section icon={BookOpen} iconColor="text-muted-foreground" title="Related Topics to Explore" defaultOpen={false}>
                <div className="flex flex-wrap gap-2 mt-4">
                  {result.relatedTopics.map((t, i) => (
                    <span key={i} className="text-sm px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{t}</span>
                  ))}
                </div>
              </Section>
            )}

            {/* Translation */}
            <Section icon={Globe} iconColor="text-teal-400" title="Translate Explanation" defaultOpen={false}>
              <div className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">Translate the explanation into another language for easier understanding.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={selectedLang} onChange={e => { setSelectedLang(e.target.value); setTranslatedText(null); }}
                    className="px-3 py-2 bg-secondary border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500 transition-colors">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                  </select>
                  <Button variant="outline" size="sm" disabled={selectedLang === "English" || translating} onClick={handleTranslate}
                    className="border-teal-500/30 hover:border-teal-500 text-teal-400 hover:text-teal-300">
                    {translating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Translating…</> : "Translate"}
                  </Button>
                </div>
                <AnimatePresence>
                  {translatedText && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl">
                      <p className="text-xs text-teal-400 font-medium mb-2 uppercase tracking-wide">{selectedLang}</p>
                      <p className="text-muted-foreground leading-relaxed">{translatedText}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Section>

            {/* Audio */}
            <Section icon={Volume2} iconColor="text-green-400" title="Audio Learning" defaultOpen={false}>
              <div className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">Listen to the explanation — great for passive revision while commuting or resting.</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <button onClick={handleSpeak} className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all",
                    isSpeaking && !isPaused ? "bg-green-500/20 border border-green-500/40 text-green-400" : "bg-green-500 text-white hover:bg-green-600"
                  )}>
                    {isSpeaking && !isPaused ? <><Pause className="w-4 h-4" />Pause</> : isPaused ? <><Play className="w-4 h-4" />Resume</> : <><Play className="w-4 h-4" />Play Explanation</>}
                  </button>
                  {isSpeaking && (
                    <button onClick={() => { window.speechSynthesis.cancel(); setIsSpeaking(false); setIsPaused(false); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-all">
                      <VolumeX className="w-4 h-4" /> Stop
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">Speed:</span>
                    {[0.7, 0.9, 1.0, 1.2].map(r => (
                      <button key={r} onClick={() => setSpeechRate(r)}
                        className={cn("text-xs px-2.5 py-1 rounded-lg border transition-all", speechRate === r ? "border-green-500/50 text-green-400 bg-green-500/10" : "border-white/10 text-muted-foreground hover:border-white/20")}>
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
