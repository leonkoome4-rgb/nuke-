import { useState } from "react";
import { ChevronDown, Compass } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import NewsSidebar from "./NewsSidebar.jsx";

export default function ExplorePanel({ reports, total }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="explore-panel">
      <button type="button" className="explore-panel__toggle" onClick={() => setOpen((v) => !v)}>
        <span>
          <Compass size={14} strokeWidth={2.5} />
          News, trends &amp; guidelines
        </span>
        <ChevronDown size={16} strokeWidth={2.25} className={`explore-panel__chevron${open ? " explore-panel__chevron--open" : ""}`} />
      </button>

      {open && (
        <div className="explore-panel__body">
          <NewsSidebar />
          <Sidebar reports={reports} total={total} />
        </div>
      )}
    </section>
  );
}
