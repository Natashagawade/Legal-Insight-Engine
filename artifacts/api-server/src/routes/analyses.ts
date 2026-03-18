import { Router, type Request, type Response } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/analyses", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(analysesTable).orderBy(desc(analysesTable.createdAt));
    res.json({ analyses: rows.map(mapAnalysis), total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch analyses" });
  }
});

router.get("/analyses/:analysisId", async (req: Request, res: Response) => {
  const { analysisId } = req.params;
  try {
    const rows = await db.select().from(analysesTable).where(eq(analysesTable.analysisId, analysisId));
    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Analysis not found" });
      return;
    }
    res.json(mapAnalysis(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch analysis" });
  }
});

router.delete("/analyses/:analysisId", async (req: Request, res: Response) => {
  const { analysisId } = req.params;
  try {
    const rows = await db.select().from(analysesTable).where(eq(analysesTable.analysisId, analysisId));
    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Analysis not found" });
      return;
    }
    await db.delete(analysesTable).where(eq(analysesTable.analysisId, analysisId));
    res.json({ success: true, message: "Analysis deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "delete_failed", message: "Failed to delete analysis" });
  }
});

router.get("/analyses/:analysisId/export", async (req: Request, res: Response) => {
  const { analysisId } = req.params;
  const format = req.query["format"] as string;

  try {
    const rows = await db.select().from(analysesTable).where(eq(analysesTable.analysisId, analysisId));
    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Analysis not found" });
      return;
    }
    const analysis = mapAnalysis(rows[0]);

    if (format === "csv") {
      const lines: string[] = [];
      lines.push("Section,Field,Value");
      lines.push(`Summary,Document,${analysis.documentName}`);
      lines.push(`Summary,Type,${analysis.documentType}`);
      lines.push(`Summary,Status,${analysis.status}`);
      lines.push(`Summary,Summary,"${String(analysis.summary ?? "").replace(/"/g, '""')}"`);

      const parties = (analysis.parties ?? []) as Array<{ name: string; role: string; obligations: string[] }>;
      parties.forEach((p) => {
        lines.push(`Party,Name,${p.name}`);
        lines.push(`Party,Role,${p.role}`);
        lines.push(`Party,Obligations,"${(p.obligations ?? []).join("; ")}"`);
      });

      const clauses = (analysis.clauses ?? []) as Array<{ type: string; title: string; riskLevel: string; explanation: string }>;
      clauses.forEach((c) => {
        lines.push(`Clause,Type,${c.type}`);
        lines.push(`Clause,Title,${c.title}`);
        lines.push(`Clause,Risk Level,${c.riskLevel}`);
        lines.push(`Clause,Explanation,"${String(c.explanation ?? "").replace(/"/g, '""')}"`);
      });

      const risks = (analysis.risks ?? []) as Array<{ level: string; description: string; clause: string }>;
      risks.forEach((r) => {
        lines.push(`Risk,Level,${r.level}`);
        lines.push(`Risk,Description,"${String(r.description ?? "").replace(/"/g, '""')}"`);
      });

      const dates = (analysis.importantDates ?? []) as Array<{ date: string; description: string; type: string }>;
      dates.forEach((d) => {
        lines.push(`Date,Date,${d.date}`);
        lines.push(`Date,Description,${d.description}`);
        lines.push(`Date,Type,${d.type}`);
      });

      const csv = lines.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="insightiq-analysis-${analysisId}.csv"`);
      res.send(csv);
    } else {
      const content = `InsightIQ Legal Analysis Report
================================
Document: ${analysis.documentName}
Type: ${analysis.documentType}
Date: ${new Date(analysis.createdAt).toLocaleDateString()}

EXECUTIVE SUMMARY
-----------------
${analysis.summary ?? "N/A"}

PARTIES INVOLVED
----------------
${((analysis.parties ?? []) as Array<{ name: string; role: string; obligations: string[] }>).map((p) => `${p.name} (${p.role})\nObligations: ${(p.obligations ?? []).join(", ")}`).join("\n\n")}

KEY CLAUSES
-----------
${((analysis.clauses ?? []) as Array<{ title: string; riskLevel: string; explanation: string }>).map((c) => `${c.title} [${c.riskLevel} risk]\n${c.explanation}`).join("\n\n")}

RISKS IDENTIFIED
----------------
${((analysis.risks ?? []) as Array<{ level: string; description: string }>).map((r) => `[${r.level.toUpperCase()}] ${r.description}`).join("\n")}

IMPORTANT DATES
---------------
${((analysis.importantDates ?? []) as Array<{ date: string; description: string; type: string }>).map((d) => `${d.date} - ${d.description} (${d.type})`).join("\n")}

SMART INSIGHTS
--------------
${((analysis.insights ?? []) as Array<{ title: string; severity: string; description: string }>).map((i) => `[${i.severity.toUpperCase()}] ${i.title}\n${i.description}`).join("\n\n")}

MISSING TERMS
-------------
${((analysis.missingTerms ?? []) as string[]).join(", ") || "None identified"}

Generated by InsightIQ - ${new Date().toISOString()}
`;
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="insightiq-analysis-${analysisId}.txt"`);
      res.send(content);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "export_failed", message: "Failed to export analysis" });
  }
});

function mapAnalysis(row: typeof analysesTable.$inferSelect) {
  return {
    analysisId: row.analysisId,
    documentId: row.documentId,
    documentName: row.documentName,
    documentType: row.documentType,
    status: row.status,
    summary: row.summary,
    parties: row.parties,
    clauses: row.clauses,
    risks: row.risks,
    importantDates: row.importantDates,
    entities: row.entities,
    insights: row.insights,
    riskDistribution: row.riskDistribution,
    missingTerms: row.missingTerms,
    ambiguousTerms: row.ambiguousTerms,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export default router;
