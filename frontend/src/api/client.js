const API_BASE = "/api";

async function handleResponse(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error || data?.errors?.join(", ") || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export function fetchReports(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return fetch(`${API_BASE}/reports?${params.toString()}`).then(handleResponse);
}

export function fetchReport(id) {
  return fetch(`${API_BASE}/reports/${id}`).then(handleResponse);
}

export function fetchReportsActivity(ids) {
  if (ids.length === 0) return Promise.resolve({ activity: [] });
  return fetch(`${API_BASE}/reports/activity?ids=${ids.join(",")}`).then(handleResponse);
}

export function createReport(payload) {
  return fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handleResponse);
}

export function flagReport(id) {
  return fetch(`${API_BASE}/reports/${id}/flag`, { method: "POST" }).then(handleResponse);
}

export function likeReport(id) {
  return fetch(`${API_BASE}/reports/${id}/like`, { method: "POST" }).then(handleResponse);
}

export function fetchKenyaPoliticsNews() {
  return fetch(`${API_BASE}/news`).then(handleResponse);
}

export function createReply(reportId, content) {
  return fetch(`${API_BASE}/reports/${reportId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  }).then(handleResponse);
}

export function flagReply(reportId, replyId) {
  return fetch(`${API_BASE}/reports/${reportId}/replies/${replyId}/flag`, {
    method: "POST",
  }).then(handleResponse);
}

// Uses XHR (not fetch) so we can report upload progress for the progress bar.
export function uploadEvidence(reportId, evidenceToken, file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/reports/${reportId}/evidence`);
    xhr.setRequestHeader("x-evidence-token", evidenceToken);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // ignore parse failure, handled by status check below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.error || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.send(formData);
  });
}

// --- Admin ---

function adminHeaders() {
  const token = sessionStorage.getItem("nuke_admin_token") || "";
  return { "x-admin-token": token, "Content-Type": "application/json" };
}

export function fetchPendingReports() {
  return fetch(`${API_BASE}/admin/reports/pending`, { headers: adminHeaders() }).then(handleResponse);
}

export function approveReport(id) {
  return fetch(`${API_BASE}/admin/reports/${id}/approve`, {
    method: "POST",
    headers: adminHeaders(),
  }).then(handleResponse);
}

export function fetchFlagged() {
  return fetch(`${API_BASE}/admin/flagged`, { headers: adminHeaders() }).then(handleResponse);
}

export function unhideReport(id) {
  return fetch(`${API_BASE}/admin/reports/${id}/unhide`, {
    method: "POST",
    headers: adminHeaders(),
  }).then(handleResponse);
}

export function removeReport(id) {
  return fetch(`${API_BASE}/admin/reports/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).then(handleResponse);
}

export function unhideReply(id) {
  return fetch(`${API_BASE}/admin/replies/${id}/unhide`, {
    method: "POST",
    headers: adminHeaders(),
  }).then(handleResponse);
}

export function removeReply(id) {
  return fetch(`${API_BASE}/admin/replies/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  }).then(handleResponse);
}
