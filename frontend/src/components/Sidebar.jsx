import { Flame, MapPin, ShieldCheck, Users, Sparkles, Landmark } from "lucide-react";
import { CATEGORIES, KENYA_TERM_LIMITS } from "../constants.js";

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

function topCounts(items, key, limit) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const GUIDELINES = [
  "Never include your own name or contact details.",
  "Every report is an unverified allegation, not proven fact.",
  "Evidence is stripped of location/device metadata automatically.",
  "Abusive or fabricated content gets reported and removed.",
];

export default function Sidebar({ reports, total }) {
  const topCategories = topCounts(reports, "category", 5);
  const topCounties = topCounts(reports, "county", 5);
  const suggested = [...reports]
    .filter((r) => (r.replies?.length || 0) === 0)
    .slice(0, 4);

  return (
    <aside className="sidebar">
      <section className="sidebar__card">
        <h3>
          <Users size={14} strokeWidth={2.5} />
          Community
        </h3>
        <div className="sidebar__stat">
          <span className="sidebar__stat-value">{total}</span>
          <span className="sidebar__stat-label">anonymous voices</span>
        </div>
      </section>

      <section className="sidebar__card">
        <h3>
          <Flame size={14} strokeWidth={2.5} />
          Trending topics
        </h3>
        {topCategories.length === 0 ? (
          <p className="sidebar__empty">Nothing trending yet.</p>
        ) : (
          <ul className="sidebar__list">
            {topCategories.map(([value, count]) => (
              <li key={value}>
                <span>{categoryLabel(value)}</span>
                <span className="sidebar__count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sidebar__card">
        <h3>
          <MapPin size={14} strokeWidth={2.5} />
          Top counties
        </h3>
        {topCounties.length === 0 ? (
          <p className="sidebar__empty">No county tags yet.</p>
        ) : (
          <ul className="sidebar__list">
            {topCounties.map(([value, count]) => (
              <li key={value}>
                <span>{value}</span>
                <span className="sidebar__count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {suggested.length > 0 && (
        <section className="sidebar__card">
          <h3>
            <Sparkles size={14} strokeWidth={2.5} />
            Needs a response
          </h3>
          <ul className="sidebar__suggested">
            {suggested.map((r) => (
              <li key={r.id}>{r.description.slice(0, 70)}{r.description.length > 70 ? "…" : ""}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="sidebar__card">
        <h3>
          <Landmark size={14} strokeWidth={2.5} />
          Kenya term limits
        </h3>
        <table className="sidebar__terms">
          <thead>
            <tr>
              <th>Office</th>
              <th>Term</th>
              <th>Limit</th>
            </tr>
          </thead>
          <tbody>
            {KENYA_TERM_LIMITS.map((t) => (
              <tr key={t.role}>
                <td>{t.role}</td>
                <td>{t.length}</td>
                <td>{t.limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sidebar__terms-note">
          A "term" is one full elected period before re-election or replacement is required.
        </p>
      </section>

      <section className="sidebar__card sidebar__card--guidelines">
        <h3>
          <ShieldCheck size={14} strokeWidth={2.5} />
          Community guidelines
        </h3>
        <ul className="sidebar__list sidebar__list--plain">
          {GUIDELINES.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
