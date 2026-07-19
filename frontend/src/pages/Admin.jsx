import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchPendingReports,
  approveReport,
  fetchFlagged,
  unhideReport,
  removeReport,
  unhideReply,
  removeReply,
} from "../api/client.js";

function reportTitle(report) {
  const parts = [report.politicianName, report.position, report.county].filter(Boolean);
  return parts.length ? parts.join(" — ") : "Anonymous message";
}

function TokenGate({ onUnlock }) {
  const [token, setToken] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    sessionStorage.setItem("nuke_admin_token", token);
    onUnlock();
  }

  return (
    <form className="admin-token-gate" onSubmit={handleSubmit}>
      <div className="admin-masthead">NEWSROOM DESK</div>
      <h2>Admin</h2>
      <label>
        Admin token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <button type="submit">Continue</button>
    </form>
  );
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem("nuke_admin_token"));
  const [tab, setTab] = useState("pending");
  const [pending, setPending] = useState([]);
  const [flaggedReports, setFlaggedReports] = useState([]);
  const [flaggedReplies, setFlaggedReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "pending") {
        const data = await fetchPendingReports();
        setPending(data.reports);
      } else {
        const data = await fetchFlagged();
        setFlaggedReports(data.reports);
        setFlaggedReplies(data.replies);
      }
    } catch (err) {
      if (err.message.includes("401") || err.message === "Unauthorized") {
        sessionStorage.removeItem("nuke_admin_token");
        setUnlocked(false);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked, load]);

  if (!unlocked) {
    return <TokenGate onUnlock={() => setUnlocked(true)} />;
  }

  async function handleApprove(id) {
    await approveReport(id);
    setPending((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleUnhideReport(id) {
    await unhideReport(id);
    load();
  }

  async function handleRemoveReport(id) {
    if (!confirm("Permanently remove this report and its evidence? This cannot be undone.")) return;
    await removeReport(id);
    load();
  }

  async function handleUnhideReply(id) {
    await unhideReply(id);
    load();
  }

  async function handleRemoveReply(id) {
    if (!confirm("Permanently remove this reply? This cannot be undone.")) return;
    await removeReply(id);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-masthead">NEWSROOM DESK</div>
      <Link to="/" className="admin-back">
        ← Back to feed
      </Link>
      <div className="admin-tabs">
        <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
          Pending review ({pending.length})
        </button>
        <button className={tab === "flagged" ? "active" : ""} onClick={() => setTab("flagged")}>
          Flagged content
        </button>
        <button
          className="admin-logout"
          onClick={() => {
            sessionStorage.removeItem("nuke_admin_token");
            setUnlocked(false);
          }}
        >
          Log out
        </button>
      </div>

      {loading && <p className="status-text">Loading…</p>}
      {error && <p className="status-text status-text--error">{error}</p>}

      {tab === "pending" && !loading && (
        <div className="admin-list">
          {pending.length === 0 && <p className="status-text">Nothing awaiting review.</p>}
          {pending.map((report) => (
            <div key={report.id} className="admin-card">
              <h3>{reportTitle(report)}</h3>
              {report.category && <p className="admin-card__category">{report.category}</p>}
              <p>{report.description}</p>
              <div className="evidence-viewer">
                {report.evidence.map((e) =>
                  e.fileType === "image" ? (
                    <img key={e.id} src={e.fileUrl} alt="Evidence" />
                  ) : e.fileType === "video" ? (
                    <video key={e.id} src={e.fileUrl} controls />
                  ) : (
                    <a key={e.id} href={e.fileUrl} target="_blank" rel="noreferrer">
                      Document
                    </a>
                  )
                )}
              </div>
              <div className="admin-card__actions">
                <button onClick={() => handleApprove(report.id)}>Approve</button>
                <button className="danger" onClick={() => handleRemoveReport(report.id)}>
                  Reject &amp; delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "flagged" && !loading && (
        <div className="admin-list">
          <h3>Reports</h3>
          {flaggedReports.length === 0 && <p className="status-text">No flagged reports.</p>}
          {flaggedReports.map((report) => (
            <div key={report.id} className="admin-card">
              <h3>{reportTitle(report)}</h3>
              <p>{report.description}</p>
              <p>
                Flags: {report.flagCount} · {report.hidden ? "Hidden" : "Visible"}
              </p>
              <div className="admin-card__actions">
                {report.hidden && <button onClick={() => handleUnhideReport(report.id)}>Unhide</button>}
                <button className="danger" onClick={() => handleRemoveReport(report.id)}>
                  Remove permanently
                </button>
              </div>
            </div>
          ))}

          <h3>Replies</h3>
          {flaggedReplies.length === 0 && <p className="status-text">No flagged replies.</p>}
          {flaggedReplies.map((reply) => (
            <div key={reply.id} className="admin-card">
              <p>{reply.content}</p>
              <p>
                Flags: {reply.flagCount} · {reply.hidden ? "Hidden" : "Visible"}
              </p>
              <div className="admin-card__actions">
                {reply.hidden && <button onClick={() => handleUnhideReply(reply.id)}>Unhide</button>}
                <button className="danger" onClick={() => handleRemoveReply(reply.id)}>
                  Remove permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
