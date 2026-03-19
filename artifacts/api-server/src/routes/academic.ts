import { Router, type Request, type Response } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(pdf|doc|docx|txt)$/i)) cb(null, true);
    else cb(new Error("Only PDF, DOC, DOCX, TXT files are allowed"));
  },
});

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx") || mimetype.includes("openxmlformats")) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (lower.endsWith(".pdf") || mimetype.includes("pdf")) {
    try {
      const pdfParse = await import("pdf-parse");
      return (await pdfParse.default(buffer)).text;
    } catch {
      return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\t]/g, " ");
    }
  }
  return buffer.toString("utf-8");
}

async function analyzeAcademic(text: string, mode: "explain" | "syllabus"): Promise<Record<string, unknown>> {
  const content = text.slice(0, 22000);

  const systemPrompt = mode === "syllabus"
    ? `You are an expert academic tutor and exam preparation specialist.
Analyze this syllabus or course document and return ONLY raw JSON (no markdown):
{
  "shortSummary": "What this course/syllabus covers in 2-3 sentences",
  "subject": "Subject name and level",
  "totalTopics": 0,
  "topics": [
    {
      "name": "Topic name",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "importance": "high|medium|low",
      "estimatedHours": 0
    }
  ],
  "importantQuestions": [
    {"question": "Likely exam question", "topic": "Related topic", "difficulty": "easy|medium|hard", "type": "theory|practical|numerical"}
  ],
  "examTips": ["Specific tip for exam preparation"],
  "keyFormulas": ["Important formula or theorem with brief description"],
  "studyPlan": [
    {"week": 1, "focus": "Topics to cover", "goal": "What to achieve"}
  ],
  "difficultyLevel": "beginner|intermediate|advanced",
  "prerequisites": ["Required prior knowledge"]
}
Rules:
- importantQuestions must have at least 10 questions covering all major topics
- examTips must have at least 6 actionable tips
- topics must include ALL topics listed in the syllabus
- Be specific to the actual content, not generic advice`
    : `You are an expert AI tutor who explains ANY academic or technical topic in simple, clear language.
Analyze this document and return ONLY raw JSON (no markdown):
{
  "shortSummary": "What this document covers in 2-3 sentences",
  "subject": "Academic subject and approximate level",
  "detailedExplanation": "Comprehensive explanation of all concepts in the document in clear, simple language — as if teaching a student from scratch",
  "keyPoints": [
    {"point": "A key concept, fact, or idea from the document", "importance": "high|medium|low", "simpleExplanation": "One-sentence plain English explanation"}
  ],
  "concepts": [
    {
      "name": "Concept name",
      "definition": "Clear definition in simple terms",
      "example": "Real-world example or analogy",
      "importance": "Why this concept matters"
    }
  ],
  "stepByStep": [
    {"step": 1, "title": "Step title", "explanation": "Detailed explanation of this step", "tip": "Helpful tip for this step"}
  ],
  "importantQuestions": [
    {"question": "Question a student or examiner would ask", "answer": "Concise answer", "topic": "Related concept", "difficulty": "easy|medium|hard"}
  ],
  "examTips": ["Specific exam or study tip based on this content"],
  "memorableFacts": ["Interesting or memorable fact that helps retention"],
  "difficultyLevel": "beginner|intermediate|advanced",
  "relatedTopics": ["Related subjects or topics to explore next"]
}
Rules:
- keyPoints must have 8-15 items covering ALL major concepts
- concepts must break down every technical term in the document
- stepByStep should describe any procedure, algorithm, or process in the document
- importantQuestions must have at least 8 exam-style questions
- Explain everything as if the student has no prior knowledge
- Use analogies and real-world examples wherever possible`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 7000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this document completely:\n\n${content}` },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as Record<string, unknown>;
    if (!Array.isArray(parsed.keyPoints)) parsed.keyPoints = [];
    if (!Array.isArray(parsed.importantQuestions)) parsed.importantQuestions = [];
    if (!Array.isArray(parsed.examTips)) parsed.examTips = [];
    return parsed;
  } catch {
    return {
      shortSummary: raw.slice(0, 300),
      subject: "Unknown",
      detailedExplanation: raw,
      keyPoints: [],
      concepts: [],
      stepByStep: [],
      importantQuestions: [],
      examTips: [],
      memorableFacts: [],
      difficultyLevel: "intermediate",
      relatedTopics: [],
    };
  }
}

function makeHandler(getInput: (req: Request) => Promise<{ text: string; fileName: string; mode: "explain" | "syllabus" }>) {
  return async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      send({ type: "progress", progress: 10, message: "Preparing document…" });

      const { text, fileName, mode } = await getInput(req);

      if (!text || text.trim().length < 10) {
        send({ type: "error", message: "Could not extract readable text from the document." });
        res.end(); return;
      }

      send({ type: "progress", progress: 30, message: mode === "syllabus" ? "Reading syllabus structure…" : "Understanding document content…" });
      send({ type: "progress", progress: 55, message: "AI tutor is analyzing the material…" });

      const result = await analyzeAcademic(text, mode);

      send({ type: "progress", progress: 90, message: "Structuring educational output…" });
      send({ type: "result", data: { fileName, wordCount: text.split(/\s+/).length, mode, ...result } });
      send({ type: "progress", progress: 100, message: "Done!" });
      send({ type: "done" });
      res.end();
    } catch (err) {
      console.error("Academic analysis error:", err);
      send({ type: "error", message: "Analysis failed: " + (err instanceof Error ? err.message : "Unknown error") });
      res.end();
    }
  };
}

router.post("/academic/analyze", upload.single("file"), makeHandler(async (req) => {
  const mode = ((req.body as Record<string, string>).mode ?? "explain") as "explain" | "syllabus";
  if (!req.file) {
    const body = req.body as { text?: string; documentName?: string };
    return { text: body.text ?? "", fileName: body.documentName ?? "Pasted Notes", mode };
  }
  const text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
  return { text, fileName: req.file.originalname, mode };
}));

router.post("/academic/analyze-text", makeHandler(async (req) => {
  const { text, documentName, mode } = req.body as { text?: string; documentName?: string; mode?: string };
  return {
    text: text?.trim() ?? "",
    fileName: documentName?.trim() || "Pasted Notes",
    mode: (mode === "syllabus" ? "syllabus" : "explain") as "explain" | "syllabus",
  };
}));

export default router;
