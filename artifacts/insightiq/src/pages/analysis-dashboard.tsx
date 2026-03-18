import { useState } from "react";
import { useRoute } from "wouter";
import { exportAnalysis, useGetAnalysis } from "@workspace/api-client-react";
import { Card, Badge, Button } from "@/components/ui-elements";
import { 
  FileText, Download, ShieldAlert, Users, Scale, AlertTriangle, 
  Calendar as CalendarIcon, CheckCircle2, Search, ArrowLeft,
  ChevronRight
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS = {
  high: 'hsl(350 80% 60%)',
  medium: 'hsl(42 90% 55%)',
  low: 'hsl(142 71% 45%)',
};

export default function AnalysisDashboard() {
  const [, params] = useRoute("/analysis/:analysisId");
  const analysisId = params?.analysisId;
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "clauses" | "entities">("overview");

  const { data: analysis, isLoading, error } = useGetAnalysis(analysisId || "", {
    query: { enabled: !!analysisId }
  });

  const handleExport = async (format: "pdf" | "csv") => {
    if (!analysisId) return;
    try {
      const blob = await exportAnalysis(analysisId, { format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `InsightIQ_Analysis_${analysisId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Loading analysis dashboard...</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Analysis Not Found</h2>
        <p className="text-muted-foreground mb-6">We couldn't load the results for this document.</p>
        <Button onClick={() => window.location.href = "/"}>Return Home</Button>
      </div>
    );
  }

  // Derived data for charts
  const riskData = [
    { name: 'High Risk', value: analysis.riskDistribution?.high || 0, color: COLORS.high },
    { name: 'Medium Risk', value: analysis.riskDistribution?.medium || 0, color: COLORS.medium },
    { name: 'Low Risk', value: analysis.riskDistribution?.low || 0, color: COLORS.low },
  ].filter(d => d.value > 0);

  // Group clauses by risk level for bar chart
  const clauseRiskCounts = { high: 0, medium: 0, low: 0 };
  analysis.clauses?.forEach(c => {
    if (c.riskLevel === 'high') clauseRiskCounts.high++;
    if (c.riskLevel === 'medium') clauseRiskCounts.medium++;
    if (c.riskLevel === 'low') clauseRiskCounts.low++;
  });
  const clauseChartData = [
    { name: 'High', count: clauseRiskCounts.high, fill: COLORS.high },
    { name: 'Medium', count: clauseRiskCounts.medium, fill: COLORS.medium },
    { name: 'Low', count: clauseRiskCounts.low, fill: COLORS.low },
  ];

  const filteredClauses = analysis.clauses?.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      {/* Header */}
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
            <FileText className="w-8 h-8 text-primary" />
            {analysis.documentName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button variant="primary" onClick={() => handleExport("pdf")}>
            <Download className="w-4 h-4 mr-2" /> PDF Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-white/10">
        {(["overview", "clauses", "entities"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-3 text-sm font-medium capitalize tracking-wider transition-all relative",
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

      {activeTab === "overview" && (
        <div className="space-y-8 animate-slide-up">
          {/* Top Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* Executive Summary */}
            <Card className="p-6 md:col-span-2 xl:col-span-2 bg-gradient-to-br from-card to-card/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg"><CheckCircle2 className="w-5 h-5 text-primary" /></div>
                <h2 className="text-xl font-display font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                {analysis.summary || "No summary available for this document."}
              </p>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 xl:col-span-1">
              <Card className="p-4 flex flex-col justify-center">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Total Clauses</span>
                <span className="text-3xl font-display font-bold text-white">{analysis.clauses?.length || 0}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-center">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">High Risks</span>
                <span className="text-3xl font-display font-bold text-destructive">{riskData.find(r => r.name === 'High Risk')?.value || 0}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-center">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Parties</span>
                <span className="text-3xl font-display font-bold text-white">{analysis.parties?.length || 0}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-center">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Dates</span>
                <span className="text-3xl font-display font-bold text-primary">{analysis.importantDates?.length || 0}</span>
              </Card>
            </div>

            {/* Risk Distribution Chart */}
            <Card className="p-6 xl:col-span-1 flex flex-col">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Risk Distribution</h2>
              <div className="flex-1 min-h-[200px] relative">
                {riskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No risk data</div>
                )}
                {/* Center text for donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">{analysis.risks?.length || 0}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Risks</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Smart Insights & Risks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-0 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-destructive" /> 
                  Critical Risks Found
                </h2>
              </div>
              <div className="divide-y divide-white/5 overflow-y-auto max-h-[400px]">
                {analysis.risks?.length ? analysis.risks.map((risk, i) => (
                  <div key={i} className="p-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-white font-medium">{risk.description}</p>
                        <p className="text-xs text-muted-foreground italic">" {risk.clause} "</p>
                      </div>
                      <Badge variant={risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warning' : 'success'}>
                        {risk.level}
                      </Badge>
                    </div>
                  </div>
                )) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">No risks identified.</div>
                )}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-accent" /> 
                  Smart Insights & Improvements
                </h2>
              </div>
              <div className="divide-y divide-white/5 overflow-y-auto max-h-[400px]">
                {analysis.insights?.length ? analysis.insights.map((insight, i) => (
                  <div key={i} className="p-6 hover:bg-white/[0.02] transition-colors">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] text-accent border-accent/30 bg-accent/10">{insight.category}</Badge>
                      <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                )) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">No insights available.</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "clauses" && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-white">Extracted Clauses</h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search clauses..." 
                className="w-full pl-9 pr-4 py-2 bg-secondary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredClauses?.map((clause, i) => (
              <Card key={i} className="p-6 flex flex-col md:flex-row gap-6">
                <div className="md:w-1/4 space-y-3 border-r border-white/5 md:pr-6">
                  <Badge variant={clause.riskLevel === 'high' ? 'danger' : clause.riskLevel === 'medium' ? 'warning' : 'success'}>
                    {clause.riskLevel} risk
                  </Badge>
                  <h3 className="font-semibold text-white text-lg">{clause.title}</h3>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{clause.type}</div>
                </div>
                <div className="md:w-3/4 space-y-4">
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Original Text</h4>
                    <p className="text-sm text-white/80 leading-relaxed font-serif">"{clause.content}"</p>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                    <h4 className="text-xs uppercase tracking-wider text-primary mb-1">Simplified Explanation</h4>
                    <p className="text-sm text-primary/90 leading-relaxed">{clause.explanation}</p>
                  </div>
                </div>
              </Card>
            ))}
            {filteredClauses?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No clauses match your search.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "entities" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
          {/* Parties Involved */}
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Parties Involved
            </h2>
            <div className="space-y-4">
              {analysis.parties?.map((party, i) => (
                <Card key={i} className="p-5">
                  <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{party.name}</h3>
                      <p className="text-sm text-muted-foreground">{party.role}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Obligations</h4>
                    <ul className="space-y-2">
                      {party.obligations.map((ob, j) => (
                        <li key={j} className="text-sm text-white/80 flex items-start">
                          <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5 mr-1" />
                          <span>{ob}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Important Dates */}
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-accent" /> Timeline & Deadlines
            </h2>
            <Card className="p-6">
              <div className="relative border-l-2 border-white/10 ml-3 space-y-8 py-2">
                {analysis.importantDates?.map((dateObj, i) => (
                  <div key={i} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-accent" />
                    <div className="mb-1">
                      <Badge variant="outline" className="text-xs mb-2 border-white/20">{dateObj.type}</Badge>
                      <h3 className="text-base font-bold text-white">{dateObj.date}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{dateObj.description}</p>
                  </div>
                ))}
              </div>
            </Card>
            
            {/* Missing Terms */}
            {analysis.missingTerms && analysis.missingTerms.length > 0 && (
              <Card className="p-5 mt-6 border-destructive/30 bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider mb-3">Missing or Ambiguous Terms</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.missingTerms.map((term, i) => (
                    <li key={i} className="text-sm text-destructive/80">{term}</li>
                  ))}
                  {analysis.ambiguousTerms?.map((term, i) => (
                    <li key={`amb-${i}`} className="text-sm text-warning/80">{term}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
