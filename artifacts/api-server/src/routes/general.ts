import { Router, type Request, type Response } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx|txt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, DOCX, and TXT files are allowed"));
    }
  },
});

/* ─────────────────────────── helpers ─────────────────────────── */

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith(".docx") || mimetype.includes("openxmlformats")) {
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

  // DOC (old binary format) and plain text
  return buffer.toString("utf-8");
}

/** Detect document category from content patterns */
function detectDocCategory(text: string): "academic" | "technical-code" | "technical" | "general" {
  const sample = text.slice(0, 6000).toLowerCase();

  const codePatterns = [
    /```[\s\S]{20,}```/,
    /def\s+\w+\s*\(/,
    /function\s+\w+\s*\(/,
    /class\s+\w+\s*[\({:]/,
    /import\s+[\w{]/,
    /public\s+(static\s+)?[\w<]+\s+\w+\s*\(/,
    /\#include\s*</,
    /^\s{4}[a-zA-Z].*[;{)]/m,
    /=>|===|!==|\+=|-=|\*=|\/=/,
  ];
  const hasCode = codePatterns.some(p => p.test(text.slice(0, 10000)));

  const academicKeywords = ["abstract", "introduction", "methodology", "conclusion", "references", "bibliography",
    "hypothesis", "experiment", "literature review", "discussion", "results", "findings",
    "objective", "observation", "analysis", "theorem", "proof", "algorithm"];
  const academicScore = academicKeywords.filter(k => sample.includes(k)).length;

  const techKeywords = ["requirements", "specifications", "architecture", "implementation",
    "deployment", "configuration", "installation", "procedure", "step", "setup", "manual"];
  const techScore = techKeywords.filter(k => sample.includes(k)).length;

  if (hasCode) return "technical-code";
  if (academicScore >= 3) return "academic";
  if (techScore >= 3) return "technical";
  return "general";
}

/** Extract all fenced code blocks from text */
function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const results: Array<{ language: string; code: string }> = [];
  const fenced = [...text.matchAll(/```([\w]*)\n?([\s\S]*?)```/g)];
  for (const m of fenced) {
    const code = m[2]?.trim() ?? "";
    if (code.length > 20) results.push({ language: m[1] || "unknown", code });
  }
  // Also detect significant indented blocks (4-space or tab)
  const indented = text.match(/(?:(?:^|\n)([ ]{4}|\t)[^\n]+)+/g) ?? [];
  for (const block of indented) {
    if (block.length > 60 && !results.some(r => r.code.includes(block.trim().slice(0, 30)))) {
      results.push({ language: "unknown", code: block.trim() });
    }
  }
  return results.slice(0, 20); // cap at 20 blocks
}

/** Split text into overlapping chunks at paragraph boundaries */
function chunkText(text: string, maxChunkSize = 40000, overlap = 1500): string[] {
  if (text.length <= maxChunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);
    if (end < text.length) {
      // Prefer to break at a blank line
      const breakAt = text.lastIndexOf("\n\n", end);
      if (breakAt > start + maxChunkSize * 0.5) end = breakAt;
    }
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }
  return chunks;
}

/** Merge multi-chunk results into one coherent object */
function mergeChunkResults(results: Record<string, unknown>[]): Record<string, unknown> {
  if (results.length === 0) return buildEmptyResult("No content analyzed.");
  if (results.length === 1) return results[0];

  type KP = { point: string; importance: string };
  type TL = { date: string; event: string; description: string };
  type CA = { language: string; snippet: string; functionality: string; errors: string[]; algorithms: string[]; explanation: string; suggestions: string[] };

  const allKeyPoints: KP[] = results.flatMap(r => (r.keyPoints as KP[]) ?? []);
  const allTimeline: TL[]   = results.flatMap(r => (r.timeline as TL[]) ?? []);
  const allCode: CA[]       = results.flatMap(r => (r.codeAnalysis as CA[]) ?? []);

  // Deduplicate key points by similarity (simple prefix check)
  const seenPoints = new Set<string>();
  const dedupedKP = allKeyPoints.filter(kp => {
    const key = kp.point.slice(0, 40).toLowerCase();
    if (seenPoints.has(key)) return false;
    seenPoints.add(key);
    return true;
  });

  // Sort timeline by date text length as a heuristic for specificity
  const dedupedTL = allTimeline.filter((t, i, arr) => arr.findIndex(x => x.event === t.event) === i);

  const first = results[0];
  const last  = results[results.length - 1];

  return {
    shortSummary: first.shortSummary,
    detailedSummary: results.map(r => r.detailedSummary as string).filter(Boolean).join("\n\n"),
    keyPoints: dedupedKP.slice(0, 20),
    timeline: dedupedTL,
    documentType: first.documentType ?? "Unknown",
    mainTheme: first.mainTheme ?? "Unknown",
    wordCount: first.wordCount,
    category: first.category,
    academicStructure: first.academicStructure ?? last.academicStructure ?? null,
    codeAnalysis: allCode.slice(0, 10),
    coverageNote: `Document was split into ${results.length} sections for complete analysis.`,
  };
}

function buildEmptyResult(reason: string): Record<string, unknown> {
  return {
    shortSummary: reason,
    detailedSummary: reason,
    keyPoints: [{ point: reason, importance: "high" }],
    timeline: [],
    documentType: "Unknown",
    mainTheme: "Unable to determine",
    wordCount: 0,
    category: "general",
    academicStructure: null,
    codeAnalysis: [],
  };
}

/* ─────────────────── AI analysis functions ─────────────────── */

function buildSystemPrompt(category: string, hasCode: boolean): string {
  const baseStructure = `{
  "shortSummary": "3-5 sentence executive summary covering ALL major aspects of the document",
  "detailedSummary": "Comprehensive 3-4 paragraph summary. Cover every major section: headings, subheadings, tables, footnotes, appendices, code. Leave nothing out.",
  "keyPoints": [
    {"point": "Specific, concrete point extracted from the document", "importance": "high|medium|low"}
  ],
  "timeline": [
    {"date": "The date, step number, or time reference", "event": "Short title", "description": "Full context of this event or step"}
  ],
  "documentType": "Precise description of document type (e.g. Lab Manual, Research Paper, API Reference, Legal Contract, Technical Report)",
  "mainTheme": "The central purpose of the document in one precise sentence",
  "wordCount": 0${category === "academic" ? `,
  "academicStructure": {
    "objectives": ["List each stated objective or aim of the document"],
    "methodology": "Detailed explanation of the methods, procedures, or steps described",
    "requirements": ["List all requirements, prerequisites, or materials needed"],
    "observations": ["Key observations, results, or data points mentioned"],
    "conclusions": ["Each conclusion, finding, or recommendation made"]
  }` : ""}${hasCode ? `,
  "codeAnalysis": [
    {
      "language": "programming language",
      "snippet": "first 120 chars of the code",
      "functionality": "What this code does — be precise and complete",
      "errors": ["Any bugs, logical errors, inefficiencies, or anti-patterns found"],
      "algorithms": ["Named algorithms or data structures used"],
      "explanation": "Plain-English line-by-line explanation of the logic",
      "suggestions": ["Concrete improvement suggestions with brief reasoning"]
    }
  ]` : ""}
}`;

  let docSpecificInstructions = "";
  if (category === "academic") {
    docSpecificInstructions = `
ACADEMIC/TECHNICAL DOCUMENT RULES:
- Treat this as a lab manual, research paper, or project guide.
- Extract objectives stated at the beginning.
- Document the full methodology/procedure step-by-step.
- List all requirements, materials, prerequisites, or tools mentioned.
- Capture every observation, result, data point, or experiment outcome.
- Summarize all conclusions and recommendations.
- Preserve the logical flow: Introduction → Background → Methods → Results → Conclusion.`;
  } else if (category === "technical-code" || hasCode) {
    docSpecificInstructions = `
CODE ANALYSIS RULES:
- For every code block found, analyze it thoroughly.
- Identify the programming language precisely.
- Explain what the code does step-by-step in plain English.
- Identify any bugs, logical errors, security issues, or inefficiencies.
- Identify algorithms, design patterns, or data structures used.
- Provide actionable improvement suggestions.
- Do NOT skip or abbreviate code sections — analyze every block.`;
  }

  return `You are InsightIQ — a highly intelligent document analyst that reads and understands EVERY part of a document with the precision of an expert human analyst.

CRITICAL RULES:
1. Read and analyze the ENTIRE document — every heading, subheading, paragraph, table, footnote, code block, and annotation.
2. NEVER skip sections, abbreviate, or produce partial output.
3. keyPoints must have 8-20 items covering ALL major topics in the document.
4. If code is present, analyze every code block — functionality, errors, logic, and improvements.
5. If dates, steps, or sequences appear, include ALL of them in the timeline.
6. Do NOT fabricate information — only extract what is actually in the document.
7. Accuracy and completeness take absolute priority over speed.
8. Always return valid JSON — never return empty arrays when content is present.
9. If a section seems unclear, still analyze it as best you can and note the ambiguity.
10. wordCount = approximate word count of the full document text.
${docSpecificInstructions}

Return ONLY a raw JSON object matching this exact structure (no markdown fences, no explanation text):
${baseStructure}`;
}

async function analyzeChunk(
  chunk: string,
  category: string,
  codeBlocks: Array<{ language: string; code: string }>,
  chunkIndex: number,
  totalChunks: number
): Promise<Record<string, unknown>> {
  const hasCode = codeBlocks.length > 0;
  const systemPrompt = buildSystemPrompt(category, hasCode);

  const chunkNote = totalChunks > 1
    ? `[This is section ${chunkIndex + 1} of ${totalChunks} — analyze this section completely.]\n\n`
    : "";

  let userContent = `${chunkNote}Analyze the following document thoroughly:\n\n${chunk}`;

  if (hasCode && chunkIndex === 0) {
    const codeSection = codeBlocks.map((b, i) =>
      `--- CODE BLOCK ${i + 1} (${b.language}) ---\n${b.code.slice(0, 3000)}`
    ).join("\n\n");
    userContent += `\n\n=== IDENTIFIED CODE BLOCKS ===\n${codeSection}`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content) as Record<string, unknown>;

    // Ensure required fields always exist
    if (!Array.isArray(parsed.keyPoints)) parsed.keyPoints = [];
    if (!Array.isArray(parsed.timeline))  parsed.timeline  = [];
    if (!Array.isArray(parsed.codeAnalysis)) parsed.codeAnalysis = [];
    if (!parsed.shortSummary) parsed.shortSummary = "Summary could not be extracted for this section.";
    if (!parsed.detailedSummary) parsed.detailedSummary = parsed.shortSummary;

    return parsed;
  } catch (parseErr) {
    console.warn(`Chunk ${chunkIndex + 1} JSON parse failed:`, parseErr);
    // Fallback: return partial data rather than nothing
    return {
      shortSummary: `Section ${chunkIndex + 1}: Content processed but structured extraction failed. Raw content available.`,
      detailedSummary: chunk.slice(0, 800),
      keyPoints: [{ point: `Section ${chunkIndex + 1} of the document was processed.`, importance: "medium" }],
      timeline: [],
      documentType: "Unknown",
      mainTheme: "See summary",
      wordCount: chunk.split(/\s+/).length,
      category,
      academicStructure: null,
      codeAnalysis: [],
    };
  }
}

async function analyzeGeneral(
  text: string,
  onProgress?: (pct: number, msg: string) => void
): Promise<Record<string, unknown>> {
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const wordCount = cleanText.split(/\s+/).length;
  const category  = detectDocCategory(cleanText);
  const codeBlocks = extractCodeBlocks(cleanText);

  const MAX_SINGLE_PASS = 50000;
  const CHUNK_SIZE      = 40000;

  if (cleanText.length <= MAX_SINGLE_PASS) {
    onProgress?.(55, `Analyzing ${category === "academic" ? "academic" : category === "technical-code" ? "technical + code" : "document"} (${wordCount.toLocaleString()} words)…`);
    const result = await analyzeChunk(cleanText, category, codeBlocks, 0, 1);
    return { ...result, wordCount, category };
  }

  // Large document — multi-chunk
  const chunks = chunkText(cleanText, CHUNK_SIZE, 2000);
  onProgress?.(40, `Large document detected (${wordCount.toLocaleString()} words). Splitting into ${chunks.length} sections…`);

  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const pct = 40 + Math.round(((i + 1) / chunks.length) * 45);
    onProgress?.(pct, `Analyzing section ${i + 1} of ${chunks.length}…`);
    const r = await analyzeChunk(chunks[i], category, i === 0 ? codeBlocks : [], i, chunks.length);
    results.push(r);
  }

  const merged = mergeChunkResults(results);
  merged.wordCount = wordCount;
  merged.category  = category;
  return merged;
}

async function translateText(text: string, language: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `You are a professional translator with expertise in technical and legal terminology.
Translate the given text accurately to ${language}.
Rules:
- Preserve all meaning, tone, and structure.
- Translate technical terms accurately — do not transliterate when a proper translation exists.
- Return ONLY the translated text, no explanations or meta-commentary.`,
      },
      { role: "user", content: text },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? text;
}

/* ─────────────────────── routes ─────────────────────── */

function makeSSEHandler(
  getTextAndName: (req: Request) => Promise<{ text: string; fileName: string }>
) {
  return async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent({ type: "progress", progress: 10, message: "Preparing document…" });

      const { text, fileName } = await getTextAndName(req);

      if (!text || text.trim().length < 10) {
        sendEvent({ type: "error", message: "Could not extract readable text from the document. Ensure the file is not corrupted or password-protected." });
        res.end();
        return;
      }

      sendEvent({ type: "progress", progress: 25, message: "Text extracted — beginning deep analysis…" });

      const result = await analyzeGeneral(text, (pct, msg) => {
        sendEvent({ type: "progress", progress: pct, message: msg });
      });

      sendEvent({ type: "progress", progress: 92, message: "Structuring final output…" });

      sendEvent({
        type: "result",
        data: { fileName, ...result },
      });

      sendEvent({ type: "progress", progress: 100, message: "Analysis complete!" });
      sendEvent({ type: "done" });
      res.end();
    } catch (err) {
      console.error("General analysis error:", err);
      // Try to send a graceful fallback rather than hard error
      sendEvent({
        type: "error",
        message: "Analysis encountered an issue: " + (err instanceof Error ? err.message : "Unknown error") +
          ". Please try again or reduce document size.",
      });
      res.end();
    }
  };
}

/* POST /api/general/analyze  (multipart file) */
router.post(
  "/general/analyze",
  upload.single("file"),
  makeSSEHandler(async (req) => {
    if (!req.file) {
      const body = req.body as { text?: string; documentName?: string };
      return { text: body.text ?? "", fileName: body.documentName ?? "Pasted Document" };
    }
    const text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    return { text, fileName: req.file.originalname };
  })
);

/* POST /api/general/analyze-text  (JSON body) */
router.post("/general/analyze-text", makeSSEHandler(async (req) => {
  const { text, documentName } = req.body as { text?: string; documentName?: string };
  return { text: text?.trim() ?? "", fileName: documentName?.trim() || "Pasted Document" };
}));

/* POST /api/general/translate */
router.post("/general/translate", async (req: Request, res: Response) => {
  try {
    const { text, language } = req.body as { text?: string; language?: string };
    if (!text || !language) {
      res.status(400).json({ error: "text and language are required" });
      return;
    }
    const translatedText = await translateText(text, language);
    res.json({ translatedText, language });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: "Translation failed", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
