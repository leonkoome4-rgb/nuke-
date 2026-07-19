// Tracks what the current browser session has already seen on its own
// reports, so the notification badge only ever reflects genuinely new
// activity (never re-shows counts the visitor already looked at).
const SEEN_KEY = "nuke_seen_activity";

function read() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || {};
  } catch {
    return {};
  }
}

function write(data) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(data));
}

// { [reportId]: { replyCount, corroborated } }
export function getSeen(reportId) {
  return read()[reportId] || { replyCount: 0, corroborated: false };
}

export function markSeen(reportId, { replyCount, corroborated }) {
  const data = read();
  data[reportId] = { replyCount, corroborated };
  write(data);
}
