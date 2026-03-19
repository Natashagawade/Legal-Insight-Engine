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

  return buffer.toString("utf-8");
}

async function analyzeGeneral(text: string): Promise<Record<string, unknown>> {
  const truncated = text.slice(0, 15000);

  const systemPrompt = `You are a highly capable document intelligence assistant. Analyze the provided document and return a JSON object with this exact structure (no markdown, raw JSON only):
{
  "shortSummary": "A concise 3-5 sentence summary of the document",
  "detailedSummary": "A comprehensive 2-3 paragraph summary covering all major points, context, and conclusions",
  "keyPoints": [
    {"point": "Main idea or important fact", "importance": "high|medium|low"}
  ],
  "timeline": [
    {"date": "The date or time reference (e.g. 'January 2024', 'Q3 2023', 'Day 1')", "event": "Short event title", "description": "What happened or what this date refers to"}
  ],
  "documentType": "A brief description of what kind of document this is",
  "mainTheme": "The central topic or purpose of the document in one sentence",
  "wordCount": 0
}

Rules:
- keyPoints should have 5-15 items, ordered from most to least important
- timeline should include all explicit and implicit date/time references; if none exist, return []
- Be accurate, do not fabricate information not in the document
- wordCount should be an approximate word count of the original text`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 6000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this document:\n\n${truncated}` },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return {
      shortSummary: content.slice(0, 400),
      detailedSummary: content,
      keyPoints: [],
      timeline: [],
      documentType: "Unknown",
      mainTheme: "Unable to determine",
      wordCount: truncated.split(/\s+/).length,
    };
  }
}

async function translateText(text: string, language: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 3000,
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the given text to ${language}. 
Return ONLY the translated text, preserving meaning, tone, and structure. Do not add explanations or notes.`,
      },
      { role: "user", content: text },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? text;
}

/* ── POST /api/general/analyze (multipart file) ── */
router.post("/general/analyze", upload.single("file"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let text = "";
    let fileName = "Document";

    if (req.file) {
      sendEvent({ type: "progress", progress: 15, message: "Extracting text from file…" });
      text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
      fileName = req.file.originalname;
    } else {
      const body = req.body as { text?: string; documentName?: string };
      text = body.text ?? "";
      fileName = body.documentName ?? "Pasted Document";
    }

    if (!text || text.trim().length < 10) {
      sendEvent({ type: "error", message: "Could not extract readable text from the document." });
      res.end();
      return;
    }

    sendEvent({ type: "progress", progress: 30, message: "Text extracted successfully" });
    sendEvent({ type: "progress", progress: 50, message: "AI is reading and understanding the document…" });

    const result = await analyzeGeneral(text);

    sendEvent({ type: "progress", progress: 90, message: "Building structured output…" });

    sendEvent({
      type: "result",
      data: {
        fileName,
        wordCount: result.wordCount ?? text.split(/\s+/).length,
        ...result,
      },
    });

    sendEvent({ type: "progress", progress: 100, message: "Done!" });
    sendEvent({ type: "done" });
    res.end();
  } catch (err) {
    console.error("General analysis error:", err);
    sendEvent({ type: "error", message: "Analysis failed: " + (err instanceof Error ? err.message : "Unknown error") });
    res.end();
  }
});

/* ── POST /api/general/analyze-text (JSON body) ── */
router.post("/general/analyze-text", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { text, documentName } = req.body as { text?: string; documentName?: string };
    const fileName = documentName?.trim() || "Pasted Document";

    if (!text || text.trim().length < 10) {
      sendEvent({ type: "error", message: "Please provide at least 10 characters of text." });
      res.end();
      return;
    }

    sendEvent({ type: "progress", progress: 20, message: "Processing text input…" });
    sendEvent({ type: "progress", progress: 50, message: "AI is reading and understanding your document…" });

    const result = await analyzeGeneral(text.trim());

    sendEvent({ type: "progress", progress: 90, message: "Building structured output…" });

    sendEvent({
      type: "result",
      data: {
        fileName,
        wordCount: result.wordCount ?? text.split(/\s+/).length,
        ...result,
      },
    });

    sendEvent({ type: "progress", progress: 100, message: "Done!" });
    sendEvent({ type: "done" });
    res.end();
  } catch (err) {
    console.error("Text analysis error:", err);
    sendEvent({ type: "error", message: "Analysis failed: " + (err instanceof Error ? err.message : "Unknown error") });
    res.end();
  }
});

/* ── POST /api/general/translate ── */
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
