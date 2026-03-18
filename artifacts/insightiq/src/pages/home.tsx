import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Scale, FileSignature, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useUploadDocument } from "@workspace/api-client-react";
import { useAnalysisStream } from "@/hooks/use-analysis-stream";
import { Card, Button } from "@/components/ui-elements";
import { cn, formatBytes } from "@/lib/utils";

const DOC_TYPES = [
  { id: "contracts", label: "Contracts", icon: FileSignature, desc: "NDAs, MSAs, Employment" },
  { id: "case-files", label: "Case Files", icon: FileText, desc: "Pleadings, Briefs, Motions" },
  { id: "agreements", label: "Agreements", icon: Scale, desc: "Settlements, Term Sheets" },
  { id: "legal-notices", label: "Legal Notices", icon: AlertCircle, desc: "Cease & Desist, Evictions" },
] as const;

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<typeof DOC_TYPES[number]["id"]>("contracts");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useUploadDocument();
  const stream = useAnalysisStream();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      // 1. Upload File
      const uploadRes = await uploadMutation.mutateAsync({
        data: { file, documentType: selectedType }
      });

      // 2. Start SSE Stream for Analysis
      if (uploadRes.documentId) {
        stream.startAnalysis(uploadRes.documentId);
      }
    } catch (error) {
      console.error("Failed to analyze", error);
    }
  };

  // Auto-redirect when done
  if (stream.status === 'completed' && stream.resultId) {
    setTimeout(() => setLocation(`/analysis/${stream.resultId}`), 1000);
  }

  const isProcessing = uploadMutation.isPending || stream.status === 'analyzing';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 animate-fade-in pb-20">
      
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          AI-Powered Legal Intelligence
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">
          Transform Raw Legal Text <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Into Actionable Insights</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload any legal document to instantly extract clauses, identify risks, and uncover hidden obligations with unmatched accuracy.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!isProcessing && stream.status !== 'completed' ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Document Types */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">1. Select Document Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DOC_TYPES.map((type) => (
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

            {/* Upload Zone */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">2. Upload File</h2>
              <Card 
                className={cn(
                  "relative border-2 border-dashed transition-all duration-300 ease-in-out group",
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
                    <div className="space-y-2 animate-fade-in">
                      <p className="text-xl font-semibold text-white">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                        Remove file
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xl font-semibold text-white mb-2">Drag & drop your file here</p>
                      <p className="text-sm text-muted-foreground mb-6">Supports PDF, DOC, DOCX up to 50MB</p>
                      <div className="relative">
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                        />
                        <Button variant="secondary">Browse Files</Button>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                size="lg" 
                className="w-full md:w-auto md:min-w-[300px] text-lg rounded-full"
                disabled={!file}
                onClick={handleAnalyze}
              >
                Start Analysis
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-auto mt-20"
          >
            <Card className="p-10 text-center relative overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
              
              <div className="relative z-10 space-y-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-card border border-white/10 flex items-center justify-center shadow-2xl relative">
                  {stream.status === 'completed' ? (
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  ) : stream.status === 'error' ? (
                    <AlertCircle className="w-10 h-10 text-destructive" />
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                          className="text-white/5"
                          strokeWidth="2"
                          stroke="currentColor"
                          fill="transparent"
                          r="38"
                          cx="40"
                          cy="40"
                        />
                        <circle
                          className="text-primary transition-all duration-300 ease-out"
                          strokeWidth="2"
                          strokeDasharray={240}
                          strokeDashoffset={240 - (240 * (stream.progress || 0)) / 100}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="38"
                          cx="40"
                          cy="40"
                        />
                      </svg>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white font-display">
                    {uploadMutation.isPending 
                      ? "Uploading Document..." 
                      : stream.status === 'completed' 
                        ? "Analysis Complete!" 
                        : stream.status === 'error'
                          ? "Analysis Failed"
                          : stream.step}
                  </h3>
                  <p className="text-muted-foreground">
                    {uploadMutation.isPending 
                      ? "Securely transferring your file to our servers." 
                      : stream.status === 'error'
                        ? stream.error
                        : stream.message}
                  </p>
                </div>

                {/* Progress track */}
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: "0%" }}
                    animate={{ width: `${uploadMutation.isPending ? 10 : stream.progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.5 }}
                  />
                </div>

                {stream.status === 'completed' && (
                  <p className="text-sm text-primary font-medium animate-pulse">
                    Redirecting to dashboard...
                  </p>
                )}
                {stream.status === 'error' && (
                  <Button variant="outline" onClick={() => { stream.resetStream(); uploadMutation.reset(); }}>
                    Try Again
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
