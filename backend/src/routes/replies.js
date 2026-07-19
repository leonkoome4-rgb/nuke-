import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../lib/rateLimiter.js";
import { AUTO_HIDE_FLAG_THRESHOLD } from "../constants.js";

const router = Router();

const createReplyLimiter = rateLimit({
  scope: "create-reply",
  max: 20,
  windowMs: 60 * 60 * 1000,
});

const flagReplyLimiter = rateLimit({
  scope: "flag-reply",
  max: 30,
  windowMs: 60 * 60 * 1000,
});

function serializeReply(reply) {
  return {
    id: reply.id,
    reportId: reply.reportId,
    content: reply.content,
    flagCount: reply.flagCount,
    createdAt: reply.createdAt,
  };
}

// POST /api/reports/:reportId/replies
router.post("/:reportId/replies", createReplyLimiter, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: "content is too long" });
    }

    const report = await prisma.report.findUnique({ where: { id: req.params.reportId } });
    if (!report || !report.approved || report.hidden) {
      return res.status(404).json({ error: "Report not found" });
    }

    const reply = await prisma.reply.create({
      data: {
        reportId: report.id,
        content: content.trim(),
      },
    });

    res.status(201).json(serializeReply(reply));
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:reportId/replies/:replyId/flag
router.post("/:reportId/replies/:replyId/flag", flagReplyLimiter, async (req, res, next) => {
  try {
    const existing = await prisma.reply.findFirst({
      where: { id: req.params.replyId, reportId: req.params.reportId },
    });
    if (!existing) return res.status(404).json({ error: "Reply not found" });

    const newFlagCount = existing.flagCount + 1;
    const reply = await prisma.reply.update({
      where: { id: existing.id },
      data: {
        flagCount: newFlagCount,
        hidden: existing.hidden || newFlagCount >= AUTO_HIDE_FLAG_THRESHOLD,
      },
    });

    res.json({ id: reply.id, flagCount: reply.flagCount, hidden: reply.hidden });
  } catch (err) {
    next(err);
  }
});

export default router;
