import { useState } from "react";
import { motion } from "framer-motion";
import { useRoute } from "wouter";
import { exportAnalysis, useGetAnalysis } from "@workspace/api-client-react";
import { Card, Badge, Button } from "@/components/ui-elements";
import {
  FileText, Download, ShieldAlert, Users, AlertTriangle,
  Calendar as CalendarIcon, CheckCircle2, Search, ArrowLeft,
  ChevronRight, TrendingUp, Tag, Zap, BarChart2, PieChart as PieChartIcon, Activity
} from "lucide-react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  Legend,
  LineChart, Line, CartesianGrid,
  RadialBarChart, RadialBar,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const C = {
  high:   "hsl(350 80% 60%)",
  medium: "hsl(42 90% 55%)",
  low:    "hsl(142 71% 45%)",
  blue:   "hsl(220 90% 60%)",
  purple: "hsl(270 75% 65%)",
  cyan:   "hsl(185 80% 55%)",
  pink:   "hsl(330 75% 62%)",
};

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px" },
  itemStyle:    { color: "#fff" },
  labelStyle:   { color: "rgba(255,255,255,0.5)", fontSize: 11 },
};

/* ── animated stat card ── */
function StatCard({ label, value, color = "text-white", sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-5 flex flex-col gap-1 h-full">
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        <span className={cn("text-4xl font-extrabold leading-none", color)}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground mt-1">{sub}</span>}
      </Card>
    </motion.div>
  );
}

/* ── section heading ── */
function SectionHead({ icon: Icon, title, color = "text-primary" }: { icon: React.ElementType; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className={cn("p-2 rounded-lg bg-white/5", color)}><Icon className="w-4 h-4" /></div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
  );
}

export default function AnalysisDashboard() {
  const [, params] = useRoute("/analysis/:analysisId");
  const analysisId = params?.analysisId;
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "clauses" | "entities">("overview");

  const { data: analysis, isLoading, error } = useGetAnalysis(analysisId || "", {
    query: { enabled: !!analysisId },
  });

  const handleExport = async (fmt: "pdf" | "csv") => {
    if (!analysisId) return;
    try {
      const blob = await exportAnalysis(analysisId, { format: fmt });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `InsightIQ_${analysisId}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) { console.error(e); }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground font-medium">Loading analysis dashboard…</p>
    </div>
  );

  if (error || !analysis) return (
    <div className="text-center py-20">
      <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Analysis Not Found</h2>
      <p className="text-muted-foreground mb-6">We couldn't load the results for this document.</p>
      <Button onClick={() => window.location.href = "/"}>Return Home</Button>
    </div>
  );

  /* ── derived data ── */
  const risks      = (analysis.risks ?? []) as Array<{ level: string; description: string; clause: string }>;
  const clauses    = (analysis.clauses ?? []) as Array<{ type: string; title: string; content: string; explanation: string; riskLevel: string }>;
  const parties    = (analysis.parties ?? []) as Array<{ name: string; role: string; obligations: string[] }>;
  const entities   = (analysis.entities ?? []) as Array<{ type: string; value: string; context: string }>;
  const insights   = (analysis.insights ?? []) as Array<{ category: string; title: string; description: string; severity: string }>;
  const dates      = (analysis.importantDates ?? []) as Array<{ date: string; description: string; type: string }>;
  const missing    = (analysis.missingTerms ?? []) as string[];
  const ambiguous  = (analysis.ambiguousTerms ?? []) as string[];

  const rd = analysis.riskDistribution ?? { low: 0, medium: 0, high: 0 };
  const totalRisks = rd.low + rd.medium + rd.high;

  /* risk donut */
  const riskDonut = [
    { name: "High",   value: rd.high,   color: C.high },
    { name: "Medium", value: rd.medium, color: C.medium },
    { name: "Low",    value: rd.low,    color: C.low },
  ].filter(d => d.value > 0);

  /* clause risk bar */
  const clauseBar = [
    { name: "High",   count: clauses.filter(c => c.riskLevel === "high").length,   fill: C.high },
    { name: "Medium", count: clauses.filter(c => c.riskLevel === "medium").length, fill: C.medium },
    { name: "Low",    count: clauses.filter(c => c.riskLevel === "low").length,    fill: C.low },
  ];

  /* entity type bar */
  const entityCounts: Record<string, number> = {};
  entities.forEach(e => { entityCounts[e.type] = (entityCounts[e.type] ?? 0) + 1; });
  const entityBar = Object.entries(entityCounts).map(([name, count]) => ({ name, count }));

  /* insight severity donut */
  const sevCounts = { info: 0, warning: 0, critical: 0 };
  insights.forEach(i => { if (i.severity in sevCounts) (sevCounts as Record<string, number>)[i.severity]++; });
  const insightDonut = [
    { name: "Critical", value: sevCounts.critical, color: C.high },
    { name: "Warning",  value: sevCounts.warning,  color: C.medium },
    { name: "Info",     value: sevCounts.info,      color: C.cyan },
  ].filter(d => d.value > 0);

  /* obligation count per party */
  const partyBar = parties.map(p => ({ name: p.name.split(" ").slice(-1)[0], obligations: p.obligations.length }));

  /* clause type radar */
  const clauseTypeCounts: Record<string, number> = {};
  clauses.forEach(c => { clauseTypeCounts[c.type] = (clauseTypeCounts[c.type] ?? 0) + 1; });
  const radarData = Object.entries(clauseTypeCounts).slice(0, 8).map(([type, count]) => ({ type, count }));

  /* date type distribution */
  const dateCounts: Record<string, number> = {};
  dates.forEach(d => { dateCounts[d.type] = (dateCounts[d.type] ?? 0) + 1; });
  const dateBar = Object.entries(dateCounts).map(([name, value]) => ({ name, value, fill: C.cyan }));

  /* risk radial */
  const radialData = [
    { name: "High",   uv: rd.high,   fill: C.high },
    { name: "Medium", uv: rd.medium, fill: C.medium },
    { name: "Low",    uv: rd.low,    fill: C.low },
  ];

  /* insight category bar */
  const catCounts: Record<string, number> = {};
  insights.forEach(i => { catCounts[i.category] = (catCounts[i.category] ?? 0) + 1; });
  const catBar = Object.entries(catCounts).map(([name, count]) => ({ name, count }));

  const filteredClauses = clauses.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const TABS = ["overview", "analytics", "clauses", "entities"] as const;

  return (
    <div className="space-y-8 pb-24 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            <button onClick={() => window.history.back()} className="hover:text-white flex items-center transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>
            <span>/</span>
            <Badge variant="outline" className="uppercase tracking-widest text-[10px]">{analysis.documentType}</Badge>
            <span>/</span>
            <span>{format(new Date(analysis.createdAt), "MMM d, yyyy")}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary shrink-0" />
            {analysis.documentName}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={() => handleExport("csv")}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button variant="primary"  onClick={() => handleExport("pdf")}><Download className="w-4 h-4 mr-2" />PDF Report</Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex space-x-1 border-b border-white/10">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-3 text-sm font-medium capitalize tracking-wide transition-all relative",
              activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-white"
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          TAB: OVERVIEW
      ═══════════════════════════════════════ */}
      {activeTab === "overview" && (
        <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Total Clauses"  value={clauses.length}        color="text-white" />
            <StatCard label="High Risks"     value={rd.high}               color="text-destructive" />
            <StatCard label="Medium Risks"   value={rd.medium}             color="text-yellow-400" />
            <StatCard label="Low Risks"      value={rd.low}                color="text-green-400" />
            <StatCard label="Parties"        value={parties.length}        color="text-primary" />
            <StatCard label="Key Dates"      value={dates.length}          color="text-cyan-400" />
          </div>

          {/* Summary + Risk Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2 bg-gradient-to-br from-card to-card/40">
              <SectionHead icon={CheckCircle2} title="Executive Summary" />
              <p className="text-muted-foreground leading-relaxed">
                {analysis.summary || "No summary available."}
              </p>
              {/* risk progress bars */}
              <div className="mt-6 space-y-3">
                {[
                  { label: "High risk clauses",   pct: totalRisks ? Math.round(rd.high   / totalRisks * 100) : 0, color: "bg-[hsl(350_80%_60%)]" },
                  { label: "Medium risk clauses", pct: totalRisks ? Math.round(rd.medium / totalRisks * 100) : 0, color: "bg-[hsl(42_90%_55%)]" },
                  { label: "Low risk clauses",    pct: totalRisks ? Math.round(rd.low    / totalRisks * 100) : 0, color: "bg-[hsl(142_71%_45%)]" },
                ].map(bar => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{bar.label}</span><span>{bar.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", bar.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Risk Donut */}
            <Card className="p-6 flex flex-col">
              <SectionHead icon={PieChartIcon} title="Risk Distribution" />
              <div className="flex-1 min-h-[200px] relative">
                {riskDonut.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        paddingAngle={4} dataKey="value" stroke="none">
                        {riskDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <RechartsTooltip {...TOOLTIP_STYLE} />
                      <Legend iconType="circle" iconSize={8}
                        formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No risk data</div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "-10%" }}>
                  <span className="text-3xl font-extrabold text-white">{risks.length}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">risks</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Risks + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-0 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                <SectionHead icon={ShieldAlert} title="Critical Risks Found" color="text-destructive" />
              </div>
              <div className="divide-y divide-white/5 overflow-y-auto max-h-[380px]">
                {risks.length ? risks.map((r, i) => (
                  <div key={i} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-white font-medium">{r.description}</p>
                        {r.clause && <p className="text-xs text-muted-foreground italic">"{r.clause}"</p>}
                      </div>
                      <Badge variant={r.level === "high" ? "danger" : r.level === "medium" ? "warning" : "success"}>{r.level}</Badge>
                    </div>
                  </div>
                )) : <div className="p-6 text-center text-muted-foreground text-sm">No risks identified.</div>}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                <SectionHead icon={Zap} title="Smart Insights" color="text-yellow-400" />
              </div>
              <div className="divide-y divide-white/5 overflow-y-auto max-h-[380px]">
                {insights.length ? insights.map((ins, i) => (
                  <div key={i} className="p-5 hover:bg-white/[0.02] transition-colors">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize border-white/15">{ins.category}</Badge>
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full",
                        ins.severity === "critical" ? "bg-destructive/20 text-destructive" :
                        ins.severity === "warning"  ? "bg-yellow-500/20 text-yellow-400" : "bg-cyan-500/20 text-cyan-400"
                      )}>{ins.severity}</span>
                      <h4 className="text-sm font-semibold text-white">{ins.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{ins.description}</p>
                  </div>
                )) : <div className="p-6 text-center text-muted-foreground text-sm">No insights available.</div>}
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════
          TAB: ANALYTICS
      ═══════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

          {/* Row 1: Clause Risk Bar + Insight Severity Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <SectionHead icon={BarChart2} title="Clause Risk Breakdown" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clauseBar} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {clauseBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6 flex flex-col">
              <SectionHead icon={Activity} title="Insight Severity Split" />
              {insightDonut.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={insightDonut} cx="50%" cy="50%" outerRadius={85}
                      paddingAngle={4} dataKey="value" stroke="none">
                      {insightDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No insight data</div>
              )}
            </Card>
          </div>

          {/* Row 2: Entity Type Bar + Party Obligations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <SectionHead icon={Tag} title="Extracted Entity Types" />
              {entityBar.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={entityBar} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill={C.blue} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No entity data</div>
              )}
            </Card>

            <Card className="p-6">
              <SectionHead icon={Users} title="Obligations Per Party" />
              {partyBar.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={partyBar} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="obligations" fill={C.purple} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No party data</div>
              )}
            </Card>
          </div>

          {/* Row 3: Clause Type Radar + Date Type Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <SectionHead icon={TrendingUp} title="Clause Type Radar" />
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={90}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="type" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                    <Radar name="Clauses" dataKey="count" stroke={C.cyan} fill={C.cyan} fillOpacity={0.25} strokeWidth={2} />
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No clause type data</div>
              )}
            </Card>

            <Card className="p-6">
              <SectionHead icon={CalendarIcon} title="Date Category Breakdown" />
              {dateBar.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dateBar} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {dateBar.map((_, i) => <Cell key={i} fill={[C.cyan, C.purple, C.pink, C.blue, C.medium, C.high][i % 6]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No date data</div>
              )}
            </Card>
          </div>

          {/* Row 4: Risk Radial Gauge + Insight Category Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 flex flex-col">
              <SectionHead icon={Activity} title="Risk Level Gauge" />
              {radialData.some(d => d.uv > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RadialBarChart innerRadius="30%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0} barSize={18}>
                    <RadialBar dataKey="uv" background={{ fill: "rgba(255,255,255,0.04)" }} cornerRadius={6} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                  </RadialBarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No risk data</div>
              )}
            </Card>

            <Card className="p-6">
              <SectionHead icon={Zap} title="Insight Categories" />
              {catBar.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={catBar} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {catBar.map((_, i) => <Cell key={i} fill={[C.purple, C.blue, C.pink, C.medium][i % 4]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No insight data</div>
              )}
            </Card>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════
          TAB: CLAUSES
      ═══════════════════════════════════════ */}
      {activeTab === "clauses" && (
        <motion.div key="clauses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Extracted Clauses <span className="text-muted-foreground text-sm font-normal ml-2">{filteredClauses.length} found</span></h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search clauses…"
                className="w-full pl-9 pr-4 py-2 bg-secondary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary transition-colors"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredClauses.map((clause, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="p-6 flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/4 space-y-3 md:border-r border-white/5 md:pr-6">
                    <Badge variant={clause.riskLevel === "high" ? "danger" : clause.riskLevel === "medium" ? "warning" : "success"}>
                      {clause.riskLevel} risk
                    </Badge>
                    <h3 className="font-semibold text-white text-lg leading-tight">{clause.title}</h3>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{clause.type}</div>
                  </div>
                  <div className="md:w-3/4 space-y-4">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Original Text</h4>
                      <p className="text-sm text-white/80 leading-relaxed">"{clause.content}"</p>
                    </div>
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                      <h4 className="text-xs uppercase tracking-wider text-primary mb-1">Simplified Explanation</h4>
                      <p className="text-sm text-primary/90 leading-relaxed">{clause.explanation}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
            {filteredClauses.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No clauses match your search.</div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════
          TAB: ENTITIES
      ═══════════════════════════════════════ */}
      {activeTab === "entities" && (
        <motion.div key="entities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Parties */}
            <div className="space-y-4">
              <SectionHead icon={Users} title="Parties Involved" />
              {parties.map((party, i) => (
                <Card key={i} className="p-5">
                  <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{party.name}</h3>
                      <p className="text-sm text-muted-foreground">{party.role}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{party.obligations.length} obligations</Badge>
                  </div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Obligations</h4>
                  <ul className="space-y-2">
                    {party.obligations.map((ob, j) => (
                      <li key={j} className="text-sm text-white/80 flex items-start">
                        <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5 mr-1" />
                        <span>{ob}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            {/* Dates Timeline */}
            <div className="space-y-4">
              <SectionHead icon={CalendarIcon} title="Timeline & Deadlines" color="text-cyan-400" />
              <Card className="p-6">
                {dates.length > 0 ? (
                  <div className="relative border-l-2 border-white/10 ml-3 space-y-8 py-2">
                    {dates.map((d, i) => (
                      <div key={i} className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-cyan-400" />
                        <Badge variant="outline" className="text-[10px] mb-1 border-white/15">{d.type}</Badge>
                        <h3 className="text-base font-bold text-white">{d.date}</h3>
                        <p className="text-sm text-muted-foreground">{d.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">No dates extracted.</div>
                )}
              </Card>

              {/* Extracted Entities table */}
              {entities.length > 0 && (
                <Card className="p-5 overflow-hidden">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Extracted Entities</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="text-left py-2 pr-4">Type</th>
                          <th className="text-left py-2 pr-4">Value</th>
                          <th className="text-left py-2">Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {entities.slice(0, 15).map((e, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-[10px] capitalize">{e.type}</Badge>
                            </td>
                            <td className="py-2 pr-4 text-white font-medium">{e.value}</td>
                            <td className="py-2 text-muted-foreground text-xs truncate max-w-[200px]">{e.context}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Missing / Ambiguous Terms */}
              {(missing.length > 0 || ambiguous.length > 0) && (
                <Card className="p-5 border-destructive/25 bg-destructive/5">
                  <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider mb-3">Missing or Ambiguous Terms</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {missing.map((t, i) => <li key={i} className="text-sm text-destructive/80">{t}</li>)}
                    {ambiguous.map((t, i) => <li key={`a${i}`} className="text-sm text-yellow-400/80">{t}</li>)}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
