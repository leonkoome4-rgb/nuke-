import { Router } from "express";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { uploadBuffer } from "../lib/s3.js";
import { rateLimit } from "../lib/rateLimiter.js";
import { scanFile, processImage, processVideo, processDocument } from "../lib/mediaProcessing.js";

const router = Router();

const uploadLimiter = rateLimit({
  scope: "upload-evidence",
  max: 20,
  windowMs: 60 * 60 * 1000,
});

const MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024; // 300MB, generous enough for phone-shot video

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function classifyFileType(mimetype) {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (ALLOWED_DOCUMENT_MIMES.has(mimetype)) return "document";
  return null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `nuke-upload-${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ok =
      ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p)) ||
      ALLOWED_DOCUMENT_MIMES.has(file.mimetype);
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

// Multer's fileFilter/size errors otherwise reach the generic 500 handler;
// surface them as 400s instead since they're always a bad request, not a
// server fault.
function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// POST /api/reports/:reportId/evidence  (multipart/form-data, field name "file")
router.post("/:reportId/evidence", uploadLimiter, handleUpload, async (req, res, next) => {
  let tempFilePath = req.file?.path;
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.reportId } });
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const providedToken = req.header("x-evidence-token") || "";
    const expectedToken = Buffer.from(report.evidenceToken);
    const providedBuffer = Buffer.from(providedToken);
    const tokenValid =
      providedBuffer.length === expectedToken.length && timingSafeEqual(providedBuffer, expectedToken);
    if (!tokenValid) {
      return res.status(403).json({ error: "Invalid or missing evidence token" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }

    const fileType = classifyFileType(req.file.mimetype);
    if (!fileType) {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const { isInfected } = await scanFile(tempFilePath);
    if (isInfected) {
      return res.status(400).json({ error: "File failed a virus/malware scan and was rejected" });
    }

    let processed;
    if (fileType === "image") {
      processed = await processImage(tempFilePath);
    } else if (fileType === "video") {
      processed = await processVideo(tempFilePath, os.tmpdir());
    } else {
      processed = await processDocument(tempFilePath, req.file.originalname, req.file.mimetype);
    }

    const key = `evidence/${report.id}/${randomUUID()}.${processed.extension}`;
    const fileUrl = await uploadBuffer({
      key,
      body: processed.buffer,
      contentType: processed.contentType,
    });

    const [evidence] = await prisma.$transaction([
      prisma.evidence.create({
        data: {
          reportId: report.id,
          fileUrl,
          fileType,
          originalName: req.file.originalname,
          mimeType: processed.contentType,
          fileSize: processed.buffer.length,
        },
      }),
      // Any report with evidence attached goes back into pending review,
      // even if it was already approved — new evidence needs a fresh look.
      prisma.report.update({ where: { id: report.id }, data: { approved: false } }),
    ]);

    res.status(201).json({
      id: evidence.id,
      reportId: evidence.reportId,
      fileUrl: evidence.fileUrl,
      fileType: evidence.fileType,
      createdAt: evidence.createdAt,
      reportPendingReview: true,
    });
  } catch (err) {
    next(err);
  } finally {
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
  }
});

export default router;
