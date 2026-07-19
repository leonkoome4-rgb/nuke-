import { useState } from "react";
import { Send, Flag } from "lucide-react";
import { createReply, flagReply } from "../api/client.js";
import { trackSubmission } from "../lib/pseudonym.js";
import { relativeTime } from "../lib/time.js";
import { avatarColor } from "../lib/avatar.js";

export default function CommentThread({ reportId, comments, onCommentAdded, onToast }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const reply = await createReply(reportId, content.trim());
      trackSubmission("reply", reply.id);
      setContent("");
      onCommentAdded(reply);
    } catch (err) {
      onToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFlag(replyId) {
    try {
      await flagReply(reportId, replyId);
      onToast("Comment reported", "success");
    } catch (err) {
      onToast(err.message, "error");
    }
  }

  return (
    <div className="comment-thread">
      {comments.length === 0 ? (
        <p className="comment-thread__empty">No comments yet — be the first to weigh in.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <span className="comment__avatar" style={{ background: avatarColor(c.id) }}>
                A
              </span>
              <div className="comment__body">
                <p>{c.content}</p>
                <div className="comment__meta">
                  <span>{relativeTime(c.createdAt)}</span>
                  <button type="button" onClick={() => handleFlag(c.id)} aria-label="Report comment">
                    <Flag size={11} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment…"
          maxLength={2000}
        />
        <button type="submit" disabled={!content.trim() || submitting} aria-label="Post comment">
          <Send size={15} strokeWidth={2.25} />
        </button>
      </form>
    </div>
  );
}
