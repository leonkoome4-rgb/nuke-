export const DISCLAIMER = "Unverified allegation — not proven fact";

export const REPORT_CATEGORIES = [
  "bribery",
  "abuse_of_office",
  "embezzlement",
  "electoral_malpractice",
  "other",
];

export const REPORT_STATUSES = [
  "unverified",
  "corroborated",
  "disputed",
  "official_response",
];

export const EVIDENCE_FILE_TYPES = ["video", "image", "document"];

export const AUTO_HIDE_FLAG_THRESHOLD = 3;

// A report is "hot" (visually highlighted) once it's picked up enough reply
// activity, or an admin has explicitly marked it corroborated. This is
// unrelated to flagCount/hidden — those are abuse-moderation signals, this is
// an engagement signal — so it's computed separately here, server-side, and
// never derived from flagCount on the client.
export const HOT_REPLY_THRESHOLD = 5;
