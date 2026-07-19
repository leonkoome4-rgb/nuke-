import { Router } from "express";

const router = Router();

const CACHE_TTL_MS = 15 * 60 * 1000; // stay well under NewsData.io's free-tier daily quota
let cache = { articles: [], fetchedAt: 0 };

function normalizeArticle(raw) {
  return {
    title: raw.title,
    url: raw.link,
    source: raw.source_id || raw.source_name || "unknown",
    imageUrl: raw.image_url || null,
    publishedAt: raw.pubDate || null,
  };
}

// GET /api/news — Kenya-only political headlines, proxied so the NewsData.io
// key never reaches the browser. Degrades to an empty, non-error response
// if the key isn't configured or the upstream call fails, since this is a
// "small part" of the app and shouldn't be able to break the main feed.
router.get("/", async (req, res) => {
  try {
    if (!process.env.NEWSDATA_API_KEY) {
      return res.json({ articles: [], configured: false });
    }

    const isFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    if (isFresh) {
      return res.json({ articles: cache.articles, configured: true });
    }

    const url = new URL("https://newsdata.io/api/1/news");
    url.searchParams.set("apikey", process.env.NEWSDATA_API_KEY);
    url.searchParams.set("country", "ke");
    url.searchParams.set("category", "politics");
    url.searchParams.set("language", "en");

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[news] NewsData.io responded ${response.status}`);
      return res.json({ articles: cache.articles, configured: true });
    }

    const data = await response.json();
    const articles = (data.results || []).slice(0, 8).map(normalizeArticle);
    cache = { articles, fetchedAt: Date.now() };

    res.json({ articles, configured: true });
  } catch (err) {
    console.warn(`[news] fetch failed: ${err.message}`);
    res.json({ articles: cache.articles, configured: true });
  }
});

export default router;
