import { useState, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, Scale, FileSignature, AlertCircle,
  CheckCircle2, Loader2, Type, Upload, X, ClipboardPaste,
  FileSearch2, ArrowRight, Zap
} from "lucide-react";
import { useUploadDocument } from "@workspace/api-client-react";
import { useAnalysisStream } from "@/hooks/use-analysis-stream";
import { Card, Button } from "@/components/ui-elements";
import { cn, formatBytes } from "@/lib/utils";

const DOC_TYPES = [
  { id: "contracts",     label: "Contracts",     icon: FileSignature, desc: "NDAs, MSAs, Employment" },
  { id: "case-files",    label: "Case Files",     icon: FileText,      desc: "Pleadings, Briefs, Motions" },
  { id: "agreements",    label: "Agreements",     icon: Scale,         desc: "Settlements, Term Sheets" },
  { id: "legal-notices", label: "Legal Notices",  icon: AlertCircle,   desc: "Cease & Desist, Evictions" },
] as const;

type InputMode = "file" | "text";

export default function Home() {
  const [, setLocation] = useLocation();

  /* ─ mode toggle ─ */
  const [mode, setMode] = useState<InputMode>("file");

  /* ─ shared ─ */
  const [selectedType, setSelectedType] = useState<typeof DOC_TYPES[number]["id"]>("contracts");

  /* ─ file mode ─ */
  const [file, setFile]           = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef               = useRef<HTMLInputElement>(null);

  /* ─ text mode ─ */
  const [docText, setDocText]     = useState("");
  const [docName, setDocName]     = useState("");

  const uploadMutation = useUploadDocument();
  const stream         = useAnalysisStream();

  /* drag events */
  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  /* analyze */
  const handleAnalyze = async () => {
    if (mode === "file") {
      if (!file) return;
      try {
        const uploadRes = await uploadMutation.mutateAsync({ data: { file, documentType: selectedType } });
        if (uploadRes.documentId) stream.startAnalysis(uploadRes.documentId);
      } catch (err) { console.error(err); }
    } else {
      if (!docText.trim()) return;
      stream.startTextAnalysis(docText.trim(), selectedType, docName.trim() || undefined);
    }
  };

  /* redirect when done */
  if (stream.status === "completed" && stream.resultId) {
    setTimeout(() => setLocation(`/analysis/${stream.resultId}`), 1000);
  }

  const isProcessing = uploadMutation.isPending || stream.status === "analyzing";
  const canAnalyze   = mode === "file" ? !!file : docText.trim().length >= 20;
  const charCount    = docText.length;
  const wordCount    = docText.trim() ? docText.trim().split(/\s+/).length : 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 animate-fade-in pb-20">

      {/* ── Hero ── */}
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          AI-Powered Legal Intelligence
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Transform Raw Legal Text<br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> Into Actionable Insights</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload any legal document or paste text to instantly extract clauses, identify risks, and uncover hidden obligations.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!isProcessing && stream.status !== "completed" ? (
          <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">

            {/* ── Document Type ── */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">1. Select Document Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DOC_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      "flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-300",
                      selectedType === type.id
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
                        : "bg-card border-white/5 hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    <type.icon className={cn("w-6 h-6 mb-3", selectedType === type.id ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-semibold text-white">{type.label}</span>
                    <span className="text-xs text-muted-foreground mt-1">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Mode Toggle ── */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">2. Choose Input Method</h2>
              <div className="inline-flex p-1 bg-secondary/60 border border-white/8 rounded-xl gap-1">
                <button
                  onClick={() => setMode("file")}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                    mode === "file"
                      ? "bg-primary text-white shadow"
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  <Upload className="w-4 h-4" /> Upload File
                </button>
                <button
                  onClick={() => setMode("text")}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                    mode === "text"
                      ? "bg-primary text-white shadow"
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  <Type className="w-4 h-4" /> Paste Text
                </button>
              </div>
            </div>

            {/* ── Input Area ── */}
            <AnimatePresence mode="wait">
              {mode === "file" ? (
                <motion.div key="file-mode" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card
                    className={cn(
                      "relative border-2 border-dashed transition-all duration-300 group",
                      isDragging ? "border-primary bg-primary/5" : "border-white/10 hover:border-white/20",
                      file ? "bg-white/[0.02] border-white/20" : ""
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="p-12 md:p-20 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8 text-primary" />
                      </div>
                      {file ? (
                        <div className="space-y-3 animate-fade-in">
                          <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                            <FileText className="w-5 h-5 text-primary shrink-0" />
                            <div className="text-left">
                              <p className="text-base font-semibold text-white leading-tight">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            </div>
                            <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="ml-auto p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Ready to analyze. Click "Start Analysis" below.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xl font-semibold text-white mb-2">Drag & drop your file here</p>
                          <p className="text-sm text-muted-foreground mb-6">Supports PDF, DOC, DOCX up to 50 MB</p>
                          <div className="relative">
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              accept=".pdf,.doc,.docx"
                              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }}
                            />
                            <Button variant="secondary">Browse Files</Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="text-mode" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  {/* Document name input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Document Name <span className="text-white/30 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Service Agreement — Acme Corp"
                      value={docName}
                      onChange={e => setDocName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Text area */}
                  <div className="relative">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <ClipboardPaste className="w-3.5 h-3.5" /> Paste or Type Document Text
                    </label>
                    <textarea
                      rows={14}
                      placeholder={"Paste your legal document text here…\n\nYou can paste the full body of a contract, agreement, legal notice, or case file. InsightIQ will extract all clauses, parties, risks, dates, and insights automatically."}
                      value={docText}
                      onChange={e => setDocText(e.target.value)}
                      className="w-full px-4 py-3 bg-secondary border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed font-mono"
                    />
                    {/* stats bar */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-3 text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg pointer-events-none">
                      <span>{wordCount.toLocaleString()} words</span>
                      <span className="w-px h-3 bg-white/10" />
                      <span className={cn(charCount < 20 && charCount > 0 ? "text-destructive" : "")}>{charCount.toLocaleString()} chars</span>
                    </div>
                  </div>

                  {charCount > 0 && charCount < 20 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Please enter at least 20 characters.
                    </p>
                  )}

                  {/* quick paste tips */}
                  <div className="flex flex-wrap gap-2">
                    {["NDA Agreement", "Service Contract", "Legal Notice", "Employment Agreement"].map(label => (
                      <button
                        key={label}
                        onClick={() => setDocName(label)}
                        className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                className="w-full md:w-auto md:min-w-[300px] text-lg rounded-full"
                disabled={!canAnalyze}
                onClick={handleAnalyze}
              >
                {mode === "file" ? (
                  <><Upload className="w-5 h-5 mr-2" /> Analyze Document</>
                ) : (
                  <><Type className="w-5 h-5 mr-2" /> Analyze Text</>
                )}
              </Button>
            </div>
          </motion.div>
        ) : (
          /* ── Processing Overlay ── */
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-auto mt-16"
          >
            <Card className="p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative z-10 space-y-8">
                {/* spinner + progress ring */}
                <div className="w-20 h-20 mx-auto rounded-full bg-card border border-white/10 flex items-center justify-center shadow-2xl relative">
                  {stream.status === "completed" ? (
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  ) : stream.status === "error" ? (
                    <AlertCircle className="w-10 h-10 text-destructive" />
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle strokeWidth="2" stroke="rgba(255,255,255,0.05)" fill="transparent" r="38" cx="40" cy="40" />
                        <circle
                          className="text-primary transition-all duration-300 ease-out"
                          strokeWidth="2"
                          strokeDasharray={240}
                          strokeDashoffset={240 - (240 * (stream.progress || 0)) / 100}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="38" cx="40" cy="40"
                        />
                      </svg>
                    </>
                  )}
                </div>

                {/* step pills */}
                <div className="flex justify-center gap-2">
                  {[
                    { key: "extracting",  label: "Extracting" },
                    { key: "analyzing",   label: "Analysing" },
                    { key: "generating",  label: "Generating" },
                  ].map(s => (
                    <span key={s.key} className={cn(
                      "text-xs px-3 py-1 rounded-full border transition-all",
                      stream.step === s.key
                        ? "border-primary text-primary bg-primary/10"
                        : "border-white/8 text-muted-foreground"
                    )}>{s.label}</span>
                  ))}
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">
                    {uploadMutation.isPending
                      ? "Uploading Document…"
                      : stream.status === "completed"
                        ? "Analysis Complete!"
                        : stream.status === "error"
                          ? "Analysis Failed"
                          : stream.step || "Processing…"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {uploadMutation.isPending
                      ? "Securely transferring your file."
                      : stream.status === "error"
                        ? stream.error
                        : stream.message}
                  </p>
                </div>

                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: "0%" }}
                    animate={{ width: `${uploadMutation.isPending ? 10 : stream.progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{uploadMutation.isPending ? 10 : stream.progress}% complete</p>

                {stream.status === "completed" && (
                  <p className="text-sm text-primary font-medium animate-pulse">Redirecting to dashboard…</p>
                )}
                {stream.status === "error" && (
                  <Button variant="outline" onClick={() => { stream.resetStream(); uploadMutation.reset(); }}>
                    Try Again
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── General Analyzer Promo ── */}
      {stream.status === "idle" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Link href="/general">
            <div className="group relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-6 cursor-pointer hover:border-violet-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5">
              <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 blur-[60px] rounded-full pointer-events-none" />
              <div className="flex items-start justify-between gap-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <FileSearch2 className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white">General Document Analyzer</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> New
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-lg">
                      Analyze <strong className="text-white/70">any document</strong> — reports, articles, research papers, manuals. Get summaries, key points, timelines, multilingual translations, and audio narration.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      {["Smart Summary", "Key Points", "Timeline", "10+ Languages", "Audio Narration"].map(f => (
                        <span key={f} className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-violet-400" />{f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-violet-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
