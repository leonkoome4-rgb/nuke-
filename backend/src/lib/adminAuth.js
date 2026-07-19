import crypto from "node:crypto";

// Constant-time comparison so this doesn't leak the token via timing.
function safeEqual(a, b) {
  const bufA = Buffer.from(a || "");
  const bufB = Buffer.from(b || "");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireAdmin(req, res, next) {
  const token = req.header("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !token || !safeEqual(token, expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
