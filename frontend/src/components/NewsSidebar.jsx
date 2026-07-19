import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { fetchKenyaPoliticsNews } from "../api/client.js";
import { relativeTime } from "../lib/time.js";

export default function NewsSidebar() {
  const [state, setState] = useState({ loading: true, configured: true, articles: [] });
  const [brokenImages, setBrokenImages] = useState(() => new Set());

  function markImageBroken(url) {
    setBrokenImages((prev) => new Set(prev).add(url));
  }

  useEffect(() => {
    fetchKenyaPoliticsNews()
      .then((data) => setState({ loading: false, configured: data.configured, articles: data.articles }))
      .catch(() => setState({ loading: false, configured: true, articles: [] }));
  }, []);

  return (
    <aside className="news-rail">
      <div className="news-rail__head">
        <span className="news-rail__icon">
          <Newspaper size={14} strokeWidth={2.5} />
        </span>
        <div>
          <h3>Kenya Politics</h3>
          <span>Live headlines</span>
        </div>
      </div>

      {state.loading && <p className="news-rail__empty">Loading headlines…</p>}
      {!state.loading && !state.configured && (
        <p className="news-rail__empty">
          News feed not configured — add <code>NEWSDATA_API_KEY</code> to the backend.
        </p>
      )}
      {!state.loading && state.configured && state.articles.length === 0 && (
        <p className="news-rail__empty">No headlines right now.</p>
      )}

      {!state.loading && state.articles.length > 0 && (
        <ul className="news-rail__list">
          {state.articles.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noreferrer" className="news-rail__link">
                {a.imageUrl && !brokenImages.has(a.url) ? (
                  <img
                    className="news-rail__thumb"
                    src={a.imageUrl}
                    alt=""
                    loading="lazy"
                    onError={() => markImageBroken(a.url)}
                  />
                ) : (
                  <span className="news-rail__thumb news-rail__thumb--placeholder">
                    <Newspaper size={16} strokeWidth={2} />
                  </span>
                )}
                <span className="news-rail__title">{a.title}</span>
                <span className="news-rail__meta">
                  <span className="news-rail__source">{a.source}</span>
                  {a.publishedAt && (
                    <>
                      <span className="news-rail__dot">·</span>
                      <span>{relativeTime(a.publishedAt)}</span>
                    </>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
