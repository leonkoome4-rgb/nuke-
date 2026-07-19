import crypto from "node:crypto";

// In-memory only: { hash -> { count, resetAt } }. Never persisted, never
// attached to any report/reply row, so there is no queryable link between a
// rate-limit hash and the content someone submitted.
const buckets = new Map();

// Sweep expired entries periodically so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

function dailySalt() {
  const day = new Date().toISOString().slice(0, 10); // rotates at UTC midnight
  return crypto.createHash("sha256").update(`${day}:${process.env.RATE_LIMIT_SECRET}`).digest();
}

// Raw IP never leaves this function — only the resulting HMAC hash is used
// downstream, and it changes every day so it can't be used to link behavior
// across days either.
function hashIp(ip) {
  return crypto.createHmac("sha256", dailySalt()).update(ip).digest("hex");
}

function clientIp(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Generic fixed-window rate limiter keyed on a daily-rotating hash of IP.
 * `scope` namespaces the bucket so e.g. report creation and flagging don't
 * share a counter.
 */
export function rateLimit({ scope, max, windowMs = 60 * 60 * 1000 }) {
  return (req, res, next) => {
    const hash = hashIp(clientIp(req));
    const key = `${scope}:${hash}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    next();
  };
}
