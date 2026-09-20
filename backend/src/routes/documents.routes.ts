import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { query } from "../db/client";
import { ensureUploadsDir, absoluteStoragePath } from "../lib/storage";
import { ApiError } from "../middleware/errorHandler";
import { generateLawsuitStatement } from "../services/caseDocumentGenerator";
import { saveLawsuitStatementDocx } from "../lib/docxBuilder";

export const documentsRouter = Router({ mergeParams: true });

const upload = multer({ dest: path.join(ensureUploadsDir(), "tmp") });

documentsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const { caseId } = req.params as { caseId: string };
    if (!req.file) {
      throw new ApiError(400, "FILE_REQUIRED");
    }

    const relativePath = path.join("case-documents", caseId, req.file.filename);
    const destination = absoluteStoragePath(relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(req.file.path, destination);

    const result = await query<{ id: string }>(
      `insert into case_documents
         (case_id, original_filename, storage_path, mime_type, size_bytes, client_description)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        caseId,
        req.file.originalname,
        relativePath,
        req.file.mimetype,
        req.file.size,
        typeof req.body.description === "string" ? req.body.description : null,
      ]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/", async (req, res, next) => {
  try {
    const { caseId } = req.params as { caseId: string };
    const result = await query(
      `select id, original_filename, client_description, uploaded_at
       from case_documents where case_id = $1 order by uploaded_at asc`,
      [caseId]
    );
    res.json({ documents: result.rows });
  } catch (err) {
    next(err);
  }
});

const generateSchema = z.object({
  documentType: z.literal("lawsuit_statement").default("lawsuit_statement"),
});

documentsRouter.post("/generate", async (req, res, next) => {
  try {
    const { caseId } = req.params as { caseId: string };
    generateSchema.parse(req.body ?? {});

    const { id, content } = await generateLawsuitStatement(caseId);
    const docxRelativePath = await saveLawsuitStatementDocx(id, content);

    await query(
      `update generated_documents set docx_storage_path = $1, status = 'finalized' where id = $2`,
      [docxRelativePath, id]
    );

    res.status(201).json({ id, content });
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:documentId", async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const result = await query(
      `select id, document_type, status, content_json, generated_at
       from generated_documents where id = $1`,
      [documentId]
    );
    const doc = result.rows[0];
    if (!doc) {
      throw new ApiError(404, "GENERATED_DOCUMENT_NOT_FOUND");
    }
    res.json({ document: doc });
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:documentId/download", async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const result = await query<{ docx_storage_path: string | null }>(
      `select docx_storage_path from generated_documents where id = $1`,
      [documentId]
    );
    const row = result.rows[0];
    if (!row?.docx_storage_path) {
      throw new ApiError(404, "DOCX_NOT_AVAILABLE");
    }

    const filePath = absoluteStoragePath(row.docx_storage_path);
    res.download(filePath, `lawsuit-statement-${documentId}.docx`);
  } catch (err) {
    next(err);
  }
});
