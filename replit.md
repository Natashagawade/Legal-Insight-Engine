# InsightIQ - Legal Document Analysis Platform

## Overview

InsightIQ is a premium AI-powered legal document analysis platform. Users upload PDF, DOC, or DOCX files, and the app performs deep AI analysis to extract structured insights including case summaries, parties, key clauses, risks, important dates, entities, and smart recommendations.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/insightiq) at path /
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Charts**: Recharts
- **File parsing**: pdf-parse, mammoth

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── insightiq/          # React + Vite frontend (InsightIQ app)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/  # OpenAI server integration
│   └── integrations-openai-ai-react/   # OpenAI React integration
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Features

1. **Document Upload**: Drag & drop or click to upload PDF, DOC, DOCX
2. **Document Type Selection**: Contracts, Case Files, Agreements, Legal Notices
3. **Real-time Analysis**: SSE streaming progress during AI analysis
4. **Analysis Dashboard**: 
   - Executive summary
   - Parties involved with obligations
   - Key clauses table with risk levels
   - Risk distribution donut chart
   - Clause categorization bar chart
   - Important dates timeline
   - Smart insights cards
   - Extracted entities table
   - Missing/ambiguous terms
   - Search and filter
   - Export to CSV/TXT
5. **History Page**: Browse and manage past analyses

## Database Schema

- `documents` table: stores uploaded document metadata and extracted text
- `analyses` table: stores AI analysis results (JSONB columns for structured data)

## API Routes

- `POST /api/documents/upload` - Upload document (multipart/form-data)
- `POST /api/documents/:documentId/analyze` - Trigger analysis (SSE stream)
- `GET /api/analyses` - List all analyses
- `GET /api/analyses/:analysisId` - Get analysis details
- `DELETE /api/analyses/:analysisId` - Delete analysis
- `GET /api/analyses/:analysisId/export?format=csv|pdf` - Export analysis

## Environment Variables

- `DATABASE_URL`, `PGHOST`, etc. - Auto-provisioned by Replit
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI proxy URL (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (auto-provisioned)
- `PORT` - Server port (auto-assigned)
