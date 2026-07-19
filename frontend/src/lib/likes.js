// Client-side only "have I already liked this" memory, purely for UX (so the
// like button doesn't invite mashing). The backend has no visitor identity
// to enforce this against server-side — see routes/reports.js.
const KEY = "nuke_liked_reports";

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY)) || []);
  } catch {
    return new Set();
  }
}

export function hasLiked(id) {
  return read().has(id);
}

export function markLiked(id) {
  const liked = read();
  liked.add(id);
  localStorage.setItem(KEY, JSON.stringify([...liked]));
}
