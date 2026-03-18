import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().unique(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  documentType: text("document_type").notNull(),
  status: text("status").notNull().default("uploaded"),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  analysisId: text("analysis_id").notNull().unique(),
  documentId: text("document_id").notNull(),
  documentName: text("document_name").notNull(),
  documentType: text("document_type").notNull(),
  status: text("status").notNull().default("pending"),
  summary: text("summary"),
  parties: jsonb("parties"),
  clauses: jsonb("clauses"),
  risks: jsonb("risks"),
  importantDates: jsonb("important_dates"),
  entities: jsonb("entities"),
  insights: jsonb("insights"),
  riskDistribution: jsonb("risk_distribution"),
  missingTerms: jsonb("missing_terms"),
  ambiguousTerms: jsonb("ambiguous_terms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true });
export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true });

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
