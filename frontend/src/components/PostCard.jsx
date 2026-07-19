import { useState } from "react";
import { Heart, MessageCircle, Share2, Flag, Play, FileText, Clock } from "lucide-react";
import { likeReport, flagReport } from "../api/client.js";
import { hasLiked, markLiked } from "../lib/likes.js";
import { avatarColor } from "../lib/avatar.js";
import { relativeTime } from "../lib/time.js";
import { CATEGORIES } from "../constants.js";
import CommentThread from "./CommentThread.jsx";

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

function MediaGrid({ evidence }) {
  if (!evidence?.length) return null;
  return (
    <div className="post-media">
      {evidence.map((e) => {
        if (e.fileType === "image") {
          return <img key={e.id} className="post-media__item" src={e.fileUrl} alt="Evidence" loading="lazy" />;
        }
        if (e.fileType === "video") {
          return (
            <div key={e.id} className="post-media__item post-media__item--video">
              <video src={e.fileUrl} controls preload="metadata" />
              <span className="post-media__play">
                <Play size={22} fill="currentColor" strokeWidth={0} />
              </span>
            </div>
          );
        }
        return (
          <a key={e.id} className="post-media__doc" href={e.fileUrl} target="_blank" rel="noreferrer">
            <FileText size={15} strokeWidth={2} />
            Document
          </a>
        );
      })}
    </div>
  );
}

export default function PostCard({ report, onToast, style, startExpanded = false, highlighted = false }) {
  const [likeCount, setLikeCount] = useState(report.likeCount);
  const [liked, setLiked] = useState(() => hasLiked(report.id));
  const [flagged, setFlagged] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(startExpanded);
  const [comments, setComments] = useState(report.replies || []);

  const tags = [report.category, report.county].filter(Boolean);

  async function handleLike() {
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    markLiked(report.id);
    try {
      await likeReport(report.id);
    } catch {
      // optimistic update stays even if the network call fails silently —
      // not worth surfacing an error toast for a like
    }
  }

  async function handleFlag() {
    if (flagged) return;
    setFlagged(true);
    try {
      await flagReport(report.id);
      onToast("Reported. Thanks for keeping this honest.", "success");
    } catch (err) {
      setFlagged(false);
      onToast(err.message, "error");
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/#${report.id}`;
    const text = report.description.slice(0, 140);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Say It", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        onToast("Link copied to clipboard", "success");
      }
    } catch {
      // user cancelled the native share sheet — not an error
    }
  }

  const cardClass = [
    "post-card",
    report.hot && "post-card--corroborated",
    highlighted && "post-card--highlighted",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass} style={style}>
      <header className="post-card__head">
        <span className="post-card__avatar" style={{ background: avatarColor(report.id) }}>
          A
        </span>
        <div className="post-card__head-meta">
          <div className="post-card__head-row">
            <span className="post-card__name">Anonymous</span>
            <span className="post-card__dot">·</span>
            <span className="post-card__time">
              <Clock size={10} strokeWidth={2.5} />
              {relativeTime(report.createdAt)}
            </span>
          </div>
          {(tags.length > 0 || report.politicianName) && (
            <div className="post-card__tags">
              {report.politicianName && <span className="post-card__politician">{report.politicianName}</span>}
              {report.category && <span className="post-tag post-tag--category">{categoryLabel(report.category)}</span>}
              {report.county && <span className="post-tag">{report.county}</span>}
            </div>
          )}
        </div>
        <span className="post-card__badge">UNVERIFIED</span>
      </header>

      {report.hot && (
        <p className="post-card__corroboration-note">
          {report.status === "corroborated" ? "Marked corroborated after review" : "Many people are discussing this"}
        </p>
      )}

      <p className="post-card__content">{report.description}</p>

      {report.pendingLocal && <span className="post-card__pending">Pending admin review — only visible to you right now</span>}

      <MediaGrid evidence={report.evidence} />

      <div className="post-card__actions">
        <button type="button" className={`post-action ${liked ? "post-action--liked" : ""}`} onClick={handleLike}>
          <Heart size={16} strokeWidth={2.25} fill={liked ? "currentColor" : "none"} />
          <span>{likeCount}</span>
        </button>
        <button type="button" className="post-action" onClick={() => setCommentsOpen((v) => !v)}>
          <MessageCircle size={16} strokeWidth={2.25} />
          <span>{comments.length}</span>
        </button>
        <button type="button" className="post-action" onClick={handleShare}>
          <Share2 size={16} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={`post-action post-action--flag ${flagged ? "post-action--flagged" : ""}`}
          onClick={handleFlag}
        >
          <Flag size={16} strokeWidth={2.25} fill={flagged ? "currentColor" : "none"} />
        </button>
      </div>

      {commentsOpen && (
        <CommentThread
          reportId={report.id}
          comments={comments}
          onCommentAdded={(reply) => setComments((prev) => [...prev, reply])}
          onToast={onToast}
        />
      )}
    </article>
  );
}
