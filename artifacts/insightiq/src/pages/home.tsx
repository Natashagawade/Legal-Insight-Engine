import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Scale, FileSearch2, GraduationCap, ArrowRight,
  CheckCircle2, Zap, Globe, Volume2, BookOpen, Code2,
  BarChart3, Calendar, Lightbulb, FileText, Shield
} from "lucide-react";

const modules = [
  {
    href: "/legal",
    icon: Scale,
    badge: "Professional",
    badgeColor: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    title: "Legal Analyzer",
    subtitle: "AI-powered legal document intelligence",
    description: "Deep analysis of contracts, agreements, NDAs, case files, and legal notices. Extract clauses, parties, risks, and obligations.",
    gradient: "from-blue-600 to-indigo-600",
    glowColor: "bg-blue-500/10",
    accentColor: "text-blue-400",
    borderColor: "border-blue-500/20 hover:border-blue-500/40",
    features: [
      { icon: Shield, label: "Risk Detection" },
      { icon: FileText, label: "Clause Extraction" },
      { icon: BarChart3, label: "Analytics Dashboard" },
      { icon: Calendar, label: "Date Extraction" },
    ],
    highlights: ["Contracts & NDAs", "Risk Scoring", "8 Analytics Charts", "Export Reports"],
  },
  {
    href: "/general",
    icon: FileSearch2,
    badge: "Universal",
    badgeColor: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    title: "General Analyzer",
    subtitle: "Understand any document instantly",
    description: "Analyze reports, articles, research papers, manuals, and code files. Full coverage analysis with summaries, key points, timelines, and code review.",
    gradient: "from-violet-600 to-purple-600",
    glowColor: "bg-violet-500/10",
    accentColor: "text-violet-400",
    borderColor: "border-violet-500/20 hover:border-violet-500/40",
    features: [
      { icon: FileSearch2, label: "Full Coverage" },
      { icon: Code2, label: "Code Analysis" },
      { icon: Globe, label: "10+ Languages" },
      { icon: Volume2, label: "Audio Narration" },
    ],
    highlights: ["PDF / DOCX / TXT", "Code Detection", "Translation", "Timeline View"],
  },
  {
    href: "/academic",
    icon: GraduationCap,
    badge: "New",
    badgeColor: "bg-green-500/10 border-green-500/20 text-green-400",
    title: "Academic Assistant",
    subtitle: "Your personal AI tutor",
    description: "Made for students. Upload notes, lab manuals, or syllabi and get step-by-step explanations, important questions, exam tips, and multilingual support.",
    gradient: "from-emerald-600 to-teal-600",
    glowColor: "bg-green-500/10",
    accentColor: "text-green-400",
    borderColor: "border-green-500/20 hover:border-green-500/40",
    features: [
      { icon: Lightbulb, label: "Simple Explanations" },
      { icon: BookOpen, label: "Syllabus Analyzer" },
      { icon: Globe, label: "Multilingual" },
      { icon: Volume2, label: "Audio Learning" },
    ],
    highlights: ["Lab Manuals", "Exam Questions", "Study Plans", "Concept Breakdown"],
  },
];

const stats = [
  { value: "3", label: "AI Modules" },
  { value: "10+", label: "Languages" },
  { value: "50k+", label: "Characters Analyzed" },
  { value: "100%", label: "Doc Coverage" },
];

export default function Home() {
  return (
    <div className="w-full max-w-6xl mx-auto pb-24 animate-fade-in">

      {/* ── Hero ── */}
      <div className="text-center space-y-6 pt-12 pb-16">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-muted-foreground mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          AI-Powered Document Intelligence Platform
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.05]">
          One Platform.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-green-400">
            Every Document.
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Analyze legal contracts, academic notes, lab manuals, and any document
          with deep AI intelligence. Instant summaries, code analysis, translations, and audio.
        </motion.p>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex flex-wrap justify-center gap-8 pt-4">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-white">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Module Cards ── */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {modules.map((mod, i) => (
          <motion.div key={mod.href} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}>
            <Link href={mod.href}>
              <div className={`group relative h-full rounded-2xl border bg-card overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${mod.borderColor}`}>
                {/* glow */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 ${mod.glowColor} blur-[60px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                {/* gradient top strip */}
                <div className={`h-1 w-full bg-gradient-to-r ${mod.gradient}`} />

                <div className="p-6 flex flex-col h-full relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <mod.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${mod.badgeColor}`}>
                      {mod.badge}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-1">{mod.title}</h2>
                  <p className={`text-xs font-medium mb-3 ${mod.accentColor}`}>{mod.subtitle}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{mod.description}</p>

                  {/* Feature icons */}
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {mod.features.map(f => (
                      <div key={f.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <f.icon className={`w-3.5 h-3.5 ${mod.accentColor} shrink-0`} />
                        {f.label}
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {mod.highlights.map(h => (
                      <span key={h} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-muted-foreground">
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className={`flex items-center gap-2 text-sm font-semibold ${mod.accentColor} group-hover:gap-3 transition-all`}>
                    Open {mod.title} <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Universal Features Banner ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-2xl border border-white/8 bg-white/[0.02] p-8">
        <h3 className="text-center text-lg font-bold text-white mb-6">All modules include</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Globe, title: "10+ Languages", desc: "AI translation preserving meaning & context" },
            { icon: Volume2, title: "Audio Narration", desc: "Play summaries & explanations aloud" },
            { icon: Zap, title: "Streaming Analysis", desc: "Real-time progress with live updates" },
            { icon: CheckCircle2, title: "100% Coverage", desc: "Every section, clause, and code block analyzed" },
          ].map(f => (
            <div key={f.title} className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
