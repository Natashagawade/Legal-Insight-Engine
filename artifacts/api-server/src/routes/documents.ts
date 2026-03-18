import { Router, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { db, documentsTable, analysesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
  },
});

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith(".docx") || mimetype.includes("openxmlformats")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (lowerName.endsWith(".doc") || mimetype.includes("msword")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (lowerName.endsWith(".pdf") || mimetype.includes("pdf")) {
    try {
      const pdfParse = await import("pdf-parse");
      const data = await pdfParse.default(buffer);
      return data.text;
    } catch {
      return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\t]/g, " ");
    }
  }

  return buffer.toString("utf-8");
}

async function analyzeWithAI(text: string, documentType: string): Promise<Record<string, unknown>> {
  const truncatedText = text.slice(0, 15000);

  const systemPrompt = `You are an expert legal document analyst. Analyze the provided legal document and extract structured insights. 
Return a JSON object with the following structure (no markdown, just raw JSON):
{
  "summary": "Executive summary of the document in 2-3 sentences",
  "parties": [{"name": "...", "role": "...", "obligations": ["..."]}],
  "clauses": [{"type": "...", "title": "...", "content": "...", "explanation": "simplified explanation", "riskLevel": "low|medium|high"}],
  "risks": [{"level": "low|medium|high", "description": "...", "clause": "relevant clause"}],
  "importantDates": [{"date": "...", "description": "...", "type": "agreement|deadline|expiry|renewal|payment|other"}],
  "entities": [{"type": "person|organization|date|amount|location|other", "value": "...", "context": "..."}],
  "insights": [{"category": "improvement|risk|clarification|summary", "title": "...", "description": "...", "severity": "info|warning|critical"}],
  "riskDistribution": {"low": 0, "medium": 0, "high": 0},
  "missingTerms": ["..."],
  "ambiguousTerms": ["..."]
}

Be thorough, accurate, and provide data-driven insights. Do not fabricate information not in the document.
Document type: ${documentType}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this legal document:\n\n${truncatedText}` },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    const risks = (parsed.risks ?? []) as Array<{ level: string }>;
    if (!parsed.riskDistribution) {
      parsed.riskDistribution = {
        low: risks.filter((r) => r.level === "low").length,
        medium: risks.filter((r) => r.level === "medium").length,
        high: risks.filter((r) => r.level === "high").length,
      };
    }
    return parsed;
  } catch {
    return {
      summary: "Analysis completed. Unable to parse structured data.",
      parties: [],
      clauses: [],
      risks: [],
      importantDates: [],
      entities: [],
      insights: [{ category: "summary", title: "Document Processed", description: content.slice(0, 500), severity: "info" }],
      riskDistribution: { low: 0, medium: 0, high: 0 },
      missingTerms: [],
      ambiguousTerms: [],
    };
  }
}

router.post("/documents/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "no_file", message: "No file uploaded" });
      return;
    }

    const { documentType } = req.body as { documentType?: string };
    if (!documentType) {
      res.status(400).json({ error: "missing_type", message: "documentType is required" });
      return;
    }

    const documentId = uuidv4();

    await db.insert(documentsTable).values({
      documentId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      documentType,
      status: "uploaded",
      extractedText: null,
    });

    res.json({
      documentId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      documentType,
      status: "uploaded",
      createdAt: new Date().toISOString(),
    });

    const buffer = req.file.buffer;
    const mime = req.file.mimetype;
    const fname = req.file.originalname;

    (async () => {
      try {
        const text = await extractText(buffer, mime, fname);
        await db.update(documentsTable)
          .set({ extractedText: text, status: "text_extracted", updatedAt: new Date() })
          .where(eq(documentsTable.documentId, documentId));
      } catch {
        await db.update(documentsTable)
          .set({ status: "extraction_failed", updatedAt: new Date() })
          .where(eq(documentsTable.documentId, documentId));
      }
    })();
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "upload_failed", message: "Failed to upload document" });
  }
});

router.post("/documents/:documentId/analyze", async (req: Request, res: Response) => {
  const { documentId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent({ type: "progress", step: "extracting", progress: 10, message: "Loading document..." });

    const docs = await db.select().from(documentsTable).where(eq(documentsTable.documentId, documentId));
    const doc = docs[0];

    if (!doc) {
      sendEvent({ type: "error", message: "Document not found" });
      res.end();
      return;
    }

    let text = doc.extractedText ?? "";

    if (!text) {
      sendEvent({ type: "progress", step: "extracting", progress: 20, message: "Waiting for text extraction..." });
      await new Promise((r) => setTimeout(r, 2000));
      const docs2 = await db.select().from(documentsTable).where(eq(documentsTable.documentId, documentId));
      text = docs2[0]?.extractedText ?? "";
    }

    if (!text) {
      text = "Unable to extract text from this document. Please ensure the file is not corrupted or password-protected.";
    }

    sendEvent({ type: "progress", step: "extracting", progress: 35, message: "Text extracted successfully" });

    const analysisId = uuidv4();

    await db.insert(analysesTable).values({
      analysisId,
      documentId,
      documentName: doc.fileName,
      documentType: doc.documentType,
      status: "processing",
    });

    sendEvent({ type: "progress", step: "analyzing", progress: 50, message: "AI is analyzing the document..." });

    const analysisData = await analyzeWithAI(text, doc.documentType);

    sendEvent({ type: "progress", step: "generating", progress: 85, message: "Generating structured insights..." });

    const completedAt = new Date();
    await db.update(analysesTable)
      .set({
        status: "completed",
        summary: (analysisData.summary as string) ?? null,
        parties: analysisData.parties as Record<string, unknown>[],
        clauses: analysisData.clauses as Record<string, unknown>[],
        risks: analysisData.risks as Record<string, unknown>[],
        importantDates: analysisData.importantDates as Record<string, unknown>[],
        entities: analysisData.entities as Record<string, unknown>[],
        insights: analysisData.insights as Record<string, unknown>[],
        riskDistribution: analysisData.riskDistribution as Record<string, unknown>,
        missingTerms: analysisData.missingTerms as string[],
        ambiguousTerms: analysisData.ambiguousTerms as string[],
        completedAt,
      })
      .where(eq(analysesTable.analysisId, analysisId));

    const fullResult = {
      analysisId,
      documentId,
      documentName: doc.fileName,
      documentType: doc.documentType,
      status: "completed",
      ...analysisData,
      createdAt: new Date().toISOString(),
      completedAt: completedAt.toISOString(),
    };

    sendEvent({ type: "progress", step: "generating", progress: 100, message: "Analysis complete!" });
    sendEvent({ type: "result", data: fullResult });
    sendEvent({ type: "done" });
    res.end();
  } catch (err) {
    console.error("Analysis error:", err);
    sendEvent({ type: "error", message: "Analysis failed: " + (err instanceof Error ? err.message : "Unknown error") });
    res.end();
  }
});

router.post("/documents/analyze-text", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { text, documentType, documentName } = req.body as {
      text?: string;
      documentType?: string;
      documentName?: string;
    };

    if (!text || text.trim().length < 20) {
      sendEvent({ type: "error", message: "Please provide at least 20 characters of document text." });
      res.end();
      return;
    }

    if (!documentType) {
      sendEvent({ type: "error", message: "documentType is required." });
      res.end();
      return;
    }

    sendEvent({ type: "progress", step: "extracting", progress: 20, message: "Processing text input..." });

    const documentId = uuidv4();
    const fileName = documentName?.trim() || "Pasted Document";

    await db.insert(documentsTable).values({
      documentId,
      fileName,
      fileSize: Buffer.byteLength(text, "utf8"),
      documentType,
      status: "text_extracted",
      extractedText: text,
    });

    sendEvent({ type: "progress", step: "extracting", progress: 35, message: "Text ready for analysis" });

    const analysisId = uuidv4();
    await db.insert(analysesTable).values({
      analysisId,
      documentId,
      documentName: fileName,
      documentType,
      status: "processing",
    });

    sendEvent({ type: "progress", step: "analyzing", progress: 50, message: "AI is analyzing your document..." });

    const analysisData = await analyzeWithAI(text, documentType);

    sendEvent({ type: "progress", step: "generating", progress: 85, message: "Generating structured insights..." });

    const completedAt = new Date();
    await db.update(analysesTable)
      .set({
        status: "completed",
        summary: (analysisData.summary as string) ?? null,
        parties: analysisData.parties as Record<string, unknown>[],
        clauses: analysisData.clauses as Record<string, unknown>[],
        risks: analysisData.risks as Record<string, unknown>[],
        importantDates: analysisData.importantDates as Record<string, unknown>[],
        entities: analysisData.entities as Record<string, unknown>[],
        insights: analysisData.insights as Record<string, unknown>[],
        riskDistribution: analysisData.riskDistribution as Record<string, unknown>,
        missingTerms: analysisData.missingTerms as string[],
        ambiguousTerms: analysisData.ambiguousTerms as string[],
        completedAt,
      })
      .where(eq(analysesTable.analysisId, analysisId));

    const fullResult = {
      analysisId,
      documentId,
      documentName: fileName,
      documentType,
      status: "completed",
      ...analysisData,
      createdAt: new Date().toISOString(),
      completedAt: completedAt.toISOString(),
    };

    sendEvent({ type: "progress", step: "generating", progress: 100, message: "Analysis complete!" });
    sendEvent({ type: "result", data: fullResult });
    sendEvent({ type: "done" });
    res.end();
  } catch (err) {
    console.error("Text analysis error:", err);
    sendEvent({ type: "error", message: "Analysis failed: " + (err instanceof Error ? err.message : "Unknown error") });
    res.end();
  }
});

export default router;
