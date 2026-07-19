import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../lib/rateLimiter.js";
import {
  DISCLAIMER,
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  AUTO_HIDE_FLAG_THRESHOLD,
  HOT_REPLY_THRESHOLD,
} from "../constants.js";

const router = Router();

const createReportLimiter = rateLimit({
  scope: "create-report",
  max: Number(process.env.RATE_LIMIT_MAX_REPORTS_PER_HOUR) || 5,
  windowMs: 60 * 60 * 1000,
});

const flagLimiter = rateLimit({
  scope: "flag",
  max: 20,
  windowMs: 60 * 60 * 1000,
});

const likeLimiter = rateLimit({
  scope: "like",
  max: 60,
  windowMs: 60 * 60 * 1000,
});

const MAX_DESCRIPTION_LENGTH = 2000;

function serializeReport(report) {
  const visibleReplies = (report.replies || []).filter((r) => !r.hidden);
  return {
    id: report.id,
    politicianName: report.politicianName,
    position: report.position,
    county: report.county,
    category: report.category,
    description: report.description,
    incidentDate: report.incidentDate,
    status: report.status,
    officialResponse: report.officialResponse,
    flagCount: report.flagCount,
    likeCount: report.likeCount,
    createdAt: report.createdAt,
    // Engagement signal for the UI's amber "hot" bubble — deliberately
    // independent of flagCount/hidden (abuse-moderation signals). Threshold
    // lives server-side (HOT_REPLY_THRESHOLD) so the client never has to
    // guess or duplicate the rule.
    hot: report.status === "corroborated" || visibleReplies.length >= HOT_REPLY_THRESHOLD,
    evidence: (report.evidence || []).map((e) => ({
      id: e.id,
      fileUrl: e.fileUrl,
      fileType: e.fileType,
      createdAt: e.createdAt,
    })),
    replies: visibleReplies.map((r) => ({
      id: r.id,
      content: r.content,
      flagCount: r.flagCount,
      createdAt: r.createdAt,
    })),
    disclaimer: DISCLAIMER,
  };
}

function nonEmptyStringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validateReportInput(body) {
  const errors = [];
  const { category, description, incidentDate } = body;

  if (!description || typeof description !== "string" || !description.trim()) {
    errors.push("description is required");
  } else if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  }
  if (category !== undefined && category !== null && category !== "" && !REPORT_CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${REPORT_CATEGORIES.join(", ")}`);
  }
  if (incidentDate !== undefined && incidentDate !== null && incidentDate !== "") {
    if (Number.isNaN(Date.parse(incidentDate))) errors.push("incidentDate is not a valid date");
  }

  return errors;
}

// GET /api/reports - public feed, filterable
router.get("/", async (req, res, next) => {
  try {
    const { county, position, category, status } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));

    const where = {
      approved: true,
      hidden: false,
    };
    if (county) where.county = { equals: String(county), mode: "insensitive" };
    if (position) where.position = { contains: String(position), mode: "insensitive" };
    if (category && REPORT_CATEGORIES.includes(category)) where.category = category;
    if (status && REPORT_STATUSES.includes(status)) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: { evidence: true, replies: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      reports: reports.map(serializeReport),
      page,
      pageSize,
      total,
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/activity?ids=a,b,c — bulk lookup used by the frontend to
// poll for genuine activity (new replies / corroboration) on reports the
// current anonymous session posted. Deliberately narrow: only returns the
// signals needed for that (reply count, status, hot), never a general
// "what's new in the feed" payload — this must never become a vector for
// re-engagement nudges about content the visitor didn't post themselves.
// Must be registered before "/:id" or Express would treat "activity" as an id.
router.get("/activity", async (req, res, next) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (ids.length === 0) return res.json({ activity: [] });

    const reports = await prisma.report.findMany({
      where: { id: { in: ids }, approved: true, hidden: false },
      include: { replies: true },
    });

    const activity = reports.map((report) => {
      const visibleReplies = (report.replies || []).filter((r) => !r.hidden);
      return {
        id: report.id,
        replyCount: visibleReplies.length,
        status: report.status,
        hot: report.status === "corroborated" || visibleReplies.length >= HOT_REPLY_THRESHOLD,
      };
    });

    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id
router.get("/:id", async (req, res, next) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { evidence: true, replies: true },
    });
    if (!report || !report.approved || report.hidden) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(serializeReport(report));
  } catch (err) {
    next(err);
  }
});

// POST /api/reports - create a text-only report (evidence attached afterward
// via POST /:id/evidence, which flips the report to pending review).
router.post("/", createReportLimiter, async (req, res, next) => {
  try {
    const errors = validateReportInput(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { politicianName, position, county, category, description, incidentDate } = req.body;

    const report = await prisma.report.create({
      data: {
        politicianName: nonEmptyStringOrNull(politicianName),
        position: nonEmptyStringOrNull(position),
        county: nonEmptyStringOrNull(county),
        category: category || null,
        description: description.trim(),
        incidentDate: incidentDate ? new Date(incidentDate) : null,
        approved: true,
      },
      include: { evidence: true, replies: true },
    });

    // evidenceToken is deliberately included here and nowhere else — this is
    // the one moment the creator can be told the secret that lets them (and
    // only them) attach evidence to this report afterward.
    res.status(201).json({ ...serializeReport(report), evidenceToken: report.evidenceToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/like — no accounts, so this is a simple counter like
// flagCount, not a per-visitor toggle. The frontend debounces re-clicks
// locally (localStorage) purely for UI feel; the server doesn't enforce
// one-like-per-visitor since there's no visitor identity to enforce it against.
router.post("/:id/like", likeLimiter, async (req, res, next) => {
  try {
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { likeCount: { increment: 1 } },
    });
    res.json({ id: report.id, likeCount: report.likeCount });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Report not found" });
    next(err);
  }
});

// POST /api/reports/:id/flag
router.post("/:id/flag", flagLimiter, async (req, res, next) => {
  try {
    const existing = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Report not found" });

    const newFlagCount = existing.flagCount + 1;
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        flagCount: newFlagCount,
        hidden: existing.hidden || newFlagCount >= AUTO_HIDE_FLAG_THRESHOLD,
      },
    });

    res.json({ id: report.id, flagCount: report.flagCount, hidden: report.hidden });
  } catch (err) {
    next(err);
  }
});

export default router;
