export default function SkeletonCard() {
  return (
    <div className="post-card post-card--skeleton" aria-hidden="true">
      <div className="post-card__head">
        <div className="skeleton skeleton--avatar" />
        <div className="post-card__head-lines">
          <div className="skeleton skeleton--line" style={{ width: "40%" }} />
          <div className="skeleton skeleton--line" style={{ width: "25%" }} />
        </div>
      </div>
      <div className="skeleton skeleton--line" style={{ width: "95%" }} />
      <div className="skeleton skeleton--line" style={{ width: "80%" }} />
      <div className="skeleton skeleton--line" style={{ width: "60%" }} />
    </div>
  );
}
