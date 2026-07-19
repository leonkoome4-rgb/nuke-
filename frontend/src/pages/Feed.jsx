import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Radio,
  Search,
  Bell,
  Paperclip,
  Camera,
  Smile,
  Send,
  ShieldCheck,
  Info,
  X,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import { fetchReports, fetchReport, fetchReportsActivity, createReport, uploadEvidence } from "../api/client.js";
import { trackSubmission, getPseudonym, getMySubmissionIds } from "../lib/pseudonym.js";
import { getSeen, markSeen } from "../lib/activity.js";
import { avatarColor } from "../lib/avatar.js";
import { MAX_DESCRIPTION_LENGTH } from "../constants.js";
import PostCard from "../components/PostCard.jsx";
import SkeletonCard from "../components/SkeletonCard.jsx";
import ExplorePanel from "../components/ExplorePanel.jsx";
import EmojiPicker from "../components/EmojiPicker.jsx";
import WelcomeModal from "../components/WelcomeModal.jsx";
import { useToasts, ToastContainer } from "../components/Toast.jsx";

let fileId = 1;
const WELCOME_SEEN_KEY = "nuke_seen_welcome";
const BANNER_DISMISSED_KEY = "nuke_dismissed_banner";
const ACTIVITY_POLL_MS = 60000;

export default function Feed() {
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_SEEN_KEY));
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem(BANNER_DISMISSED_KEY));
  const [reports, setReports] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Notifications: genuine activity on the visitor's own reports only. Never
  // populated from general feed activity, trending content, or anything the
  // visitor didn't post themselves — see backend/src/routes/reports.js
  // GET /activity for the same constraint enforced server-side.
  const [unread, setUnread] = useState({}); // { [reportId]: { replyCount, corroborated, delta } }
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityDetails, setActivityDetails] = useState({}); // { [reportId]: report }
  const [activityLoading, setActivityLoading] = useState(false);

  const { toasts, push: toast, dismiss } = useToasts();
  const textareaRef = useRef(null);
  const pseudonym = useRef(getPseudonym());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchReports({ page: 1 })
      .then((data) => {
        setReports(data.reports);
        setTotal(data.total);
        setPage(1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const checkMyActivity = useCallback(async () => {
    const myIds = [...getMySubmissionIds("report")];
    if (myIds.length === 0) return;
    try {
      const { activity } = await fetchReportsActivity(myIds);
      const nextUnread = {};
      for (const item of activity) {
        const seen = getSeen(item.id);
        const replyDelta = Math.max(0, item.replyCount - seen.replyCount);
        const newlyCorroborated = item.status === "corroborated" && !seen.corroborated;
        if (replyDelta > 0 || newlyCorroborated) {
          nextUnread[item.id] = {
            replyCount: item.replyCount,
            corroborated: item.status === "corroborated",
            delta: replyDelta + (newlyCorroborated ? 1 : 0),
          };
        }
      }
      setUnread(nextUnread);
    } catch {
      // silent — this is a background check, not worth interrupting anyone over
    }
  }, []);

  useEffect(() => {
    checkMyActivity();
    const interval = setInterval(checkMyActivity, ACTIVITY_POLL_MS);
    return () => clearInterval(interval);
  }, [checkMyActivity]);

  const unreadCount = Object.values(unread).reduce((sum, u) => sum + u.delta, 0);

  async function toggleActivity() {
    const opening = !activityOpen;
    setActivityOpen(opening);
    if (!opening) return;

    const ids = Object.keys(unread);
    const missing = ids.filter((id) => !activityDetails[id]);
    if (missing.length === 0) return;

    setActivityLoading(true);
    try {
      const fetched = await Promise.all(missing.map((id) => fetchReport(id).catch(() => null)));
      setActivityDetails((prev) => {
        const next = { ...prev };
        fetched.forEach((report, i) => {
          if (report) next[missing[i]] = report;
        });
        return next;
      });
    } finally {
      setActivityLoading(false);
    }
  }

  function viewActivity(reportId) {
    const info = unread[reportId];
    if (info) markSeen(reportId, { replyCount: info.replyCount, corroborated: info.corroborated });

    setUnread((prev) => {
      const next = { ...prev };
      delete next[reportId];
      return next;
    });

    const existing = reports.find((r) => r.id === reportId);
    const detail = activityDetails[reportId];
    if (!existing && detail) {
      setReports((prev) => [detail, ...prev]);
    }

    setActivityOpen(false);
    setHighlightedId(reportId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => setHighlightedId((id) => (id === reportId ? null : id)), 4000);
  }

  function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    fetchReports({ page: nextPage })
      .then((data) => {
        setReports((prev) => [...prev, ...data.reports]);
        setPage(nextPage);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setFiles((prev) => [...prev, ...selected.map((file) => ({ id: fileId++, file }))]);
    e.target.value = "";
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function insertEmoji(emoji) {
    setText((t) => t + emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const report = await createReport({ description: text.trim() });
      trackSubmission("report", report.id);
      markSeen(report.id, { replyCount: 0, corroborated: false });

      let pendingLocal = false;
      for (const entry of files) {
        try {
          const evidence = await uploadEvidence(report.id, report.evidenceToken, entry.file, () => {});
          report.evidence = [...(report.evidence || []), evidence];
          pendingLocal = true;
        } catch {
          toast(`Couldn't attach "${entry.file.name}"`, "error");
        }
      }

      setReports((prev) => [{ ...report, pendingLocal, replies: [] }, ...prev]);
      setTotal((t) => t + 1);
      setText("");
      setFiles([]);
      requestAnimationFrame(autoResize);
      toast(pendingLocal ? "Posted — pending review because it has evidence" : "Posted", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSending(false);
    }
  }

  const visibleReports = search.trim()
    ? reports.filter((r) => r.description.toLowerCase().includes(search.trim().toLowerCase()))
    : reports;

  const charCount = text.length;
  const overLimit = charCount > MAX_DESCRIPTION_LENGTH;
  const hasMore = reports.length < total;

  return (
    <div className="app-shell">
      {showBanner && (
        <div className="top-banner">
          <span>🇰🇪 Kenya 2027 — Report honestly. Corroborate what you see. Hold leaders accountable.</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(BANNER_DISMISSED_KEY, "1");
              setShowBanner(false);
            }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">
            <Radio size={16} strokeWidth={2.5} />
          </span>
          <div className="topbar__brand-text">
            <span className="topbar__name">SAY IT</span>
            <span className="topbar__live">
              <span className="live-dot" />
              LIVE · {total.toLocaleString()} voices
            </span>
          </div>
        </div>

        <div className="topbar__search">
          {searchOpen ? (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => !search && setSearchOpen(false)}
              placeholder="Search reports…"
            />
          ) : (
            <button type="button" className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search size={17} strokeWidth={2.25} />
            </button>
          )}
        </div>

        <div className="topbar__actions">
          <div className="activity-wrap">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleActivity}
              aria-label="Activity on your reports"
            >
              <Bell size={17} strokeWidth={2.25} />
              {unreadCount > 0 && <span className="icon-btn__badge">{unreadCount}</span>}
            </button>
            {activityOpen && (
              <div className="activity-menu">
                <div className="activity-menu__head">Activity on your reports</div>
                {Object.keys(unread).length === 0 ? (
                  <p className="activity-menu__empty">No new activity yet.</p>
                ) : activityLoading ? (
                  <p className="activity-menu__empty">Loading…</p>
                ) : (
                  <ul>
                    {Object.entries(unread).map(([id, info]) => {
                      const detail = activityDetails[id];
                      return (
                        <li key={id}>
                          <button type="button" onClick={() => viewActivity(id)}>
                            <span className="activity-menu__snippet">
                              {detail ? detail.description.slice(0, 60) : "Your report"}
                            </span>
                            <span className="activity-menu__delta">
                              {info.corroborated && !getSeen(id).corroborated ? (
                                <>
                                  <CheckCircle2 size={12} strokeWidth={2.5} />
                                  Corroborated
                                </>
                              ) : (
                                <>
                                  <MessageCircle size={12} strokeWidth={2.5} />+{info.delta}{" "}
                                  {info.delta > 1 ? "replies" : "reply"}
                                </>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="profile-wrap">
            <button
              type="button"
              className="profile-avatar"
              style={{ background: avatarColor(pseudonym.current) }}
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="Profile"
            >
              {pseudonym.current[0]}
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu__you">
                  <span>You're posting as</span>
                  <strong>{pseudonym.current}</strong>
                  <small>Only visible to you, never shown to others.</small>
                </div>
                <Link to="/admin" onClick={() => setProfileOpen(false)}>
                  <ShieldCheck size={14} strokeWidth={2.25} />
                  Admin
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setShowWelcome(true);
                  }}
                >
                  <Info size={14} strokeWidth={2.25} />
                  About Say It
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        <ExplorePanel reports={reports} total={total} />

        <div className="feed">
          {loading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {error && <p className="feed__error">{error}</p>}

          {!loading && !error && visibleReports.length === 0 && (
            <div className="empty-state">
              <p className="empty-state__title">Nothing here yet</p>
              <p className="empty-state__body">Be the first to say something.</p>
            </div>
          )}

          {!loading &&
            visibleReports.map((report, i) => (
              <PostCard
                key={report.id}
                report={report}
                onToast={toast}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                highlighted={highlightedId === report.id}
                startExpanded={highlightedId === report.id}
              />
            ))}

          {!loading && hasMore && (
            <div className="load-more">
              <button type="button" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </main>

      <div className="composer-dock">
        <section className="composer--card">
          <p className="composer__label">Say something — no questions asked</p>
          {files.length > 0 && (
            <div className="composer__files">
              {files.map((f) => (
                <span key={f.id} className="composer__file">
                  {f.file.name}
                  <button type="button" onClick={() => removeFile(f.id)} aria-label="Remove file">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {emojiOpen && <EmojiPicker onSelect={insertEmoji} />}

          <div className="composer__row">
            <label className="icon-btn composer__attach" aria-label="Attach file">
              <Paperclip size={18} strokeWidth={2.25} />
              <input type="file" multiple hidden onChange={handleFileSelect} />
            </label>

            <textarea
              ref={textareaRef}
              className="composer__input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type here…"
              rows={1}
            />

            <button type="button" className="icon-btn" onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji">
              <Smile size={18} strokeWidth={2.25} />
            </button>

            <label className="icon-btn composer__camera" aria-label="Camera">
              <Camera size={18} strokeWidth={2.25} />
              <input type="file" accept="image/*,video/*" capture="environment" hidden onChange={handleFileSelect} />
            </label>

            <button
              type="button"
              className="composer__send"
              disabled={!text.trim() || overLimit || sending}
              onClick={handleSend}
              aria-label="Send"
            >
              <Send size={16} strokeWidth={2.5} />
            </button>
          </div>

          {charCount > MAX_DESCRIPTION_LENGTH - 200 && (
            <span className={`composer__count ${overLimit ? "composer__count--over" : ""}`}>
              {charCount}/{MAX_DESCRIPTION_LENGTH}
            </span>
          )}
        </section>
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {showWelcome && (
        <WelcomeModal
          onClose={() => {
            localStorage.setItem(WELCOME_SEEN_KEY, "1");
            setShowWelcome(false);
          }}
        />
      )}
    </div>
  );
}
