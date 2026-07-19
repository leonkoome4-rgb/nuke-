// Purely client-side. Nothing here is ever sent to the backend — the API
// has no concept of an author. This only lets someone recognize their own
// past submissions in *their own* browser (e.g. "you submitted this"),
// never a persistent identity shown to other visitors.

const PSEUDONYM_KEY = "nuke_pseudonym";
const SUBMISSIONS_KEY = "nuke_my_submissions";

const ADJECTIVES = ["Quiet", "Steady", "Watchful", "Candid", "Sharp", "Plain", "Bold", "Calm"];
const ANIMALS = ["Heron", "Otter", "Falcon", "Zebra", "Serval", "Ibis", "Genet", "Kudu"];

export function getPseudonym() {
  let name = localStorage.getItem(PSEUDONYM_KEY);
  if (!name) {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const suffix = Math.floor(Math.random() * 900 + 100);
    name = `${adjective}${animal}${suffix}`;
    localStorage.setItem(PSEUDONYM_KEY, name);
  }
  return name;
}

function readSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY)) || [];
  } catch {
    return [];
  }
}

export function trackSubmission(type, id) {
  const submissions = readSubmissions();
  submissions.push({ type, id, createdAt: new Date().toISOString() });
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
}

export function getMySubmissionIds(type) {
  return new Set(
    readSubmissions()
      .filter((s) => s.type === type)
      .map((s) => s.id)
  );
}
