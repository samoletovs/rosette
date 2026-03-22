const API_BASE = "/api";
const TIMEOUT = 90000; // 90 seconds for AI calls

export interface AuthUser {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/.auth/me");
    if (!res.ok) return null;
    const data = await res.json();
    const principal = data.clientPrincipal;
    return principal || null;
  } catch {
    return null;
  }
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function safeJsonError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    const text = await res.text().catch(() => "");
    return text || `${fallback} (HTTP ${res.status})`;
  }
}

export async function uploadFile(file: File): Promise<{ id: string; url: string; blobName: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData, signal: withTimeout(30000) });
  if (!res.ok) throw new Error(await safeJsonError(res, "Upload failed"));
  return res.json();
}

export async function analyzeFloorPlan(imageUrl: string, propertyType: string): Promise<any> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, propertyType }),
    signal: withTimeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(await safeJsonError(res, "Analysis failed"));
  return res.json();
}

export async function getStandards(countryCode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/standards/${countryCode}`);
  if (!res.ok) throw new Error(await safeJsonError(res, "Standards not found"));
  return res.json();
}

export async function getCountries(): Promise<{ countries: { code: string; country: string }[] }> {
  const res = await fetch(`${API_BASE}/standards`);
  if (!res.ok) throw new Error(await safeJsonError(res, "Failed to load countries"));
  return res.json();
}

export async function calculateSockets(
  rooms: any[],
  countryCode: string,
  propertyType: string,
  standards: any
): Promise<any> {
  const res = await fetch(`${API_BASE}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rooms, countryCode, propertyType, standards }),
    signal: withTimeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(await safeJsonError(res, "Calculation failed"));
  return res.json();
}

export async function generateDescription(
  rooms: any[],
  placements: any,
  countryCode: string,
  propertyType: string
): Promise<{ description_en: string; description_local: string; language: { name: string; code: string } }> {
  const res = await fetch(`${API_BASE}/generate-description`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rooms, placements, countryCode, propertyType }),
    signal: withTimeout(TIMEOUT * 2),
  });
  if (!res.ok) throw new Error(await safeJsonError(res, "Description generation failed"));
  return res.json();
}

// ── Feedback API ──

export interface FeedbackItem {
  id: string;
  type: string;
  title: string;
  description: string;
  page?: string;
  status: string;
  createdAt: string;
}

export async function submitFeedback(data: {
  type: string;
  title: string;
  description: string;
  page?: string;
}): Promise<{ id: string; message: string }> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: withTimeout(15000),
  });
  if (!res.ok) throw new Error(await safeJsonError(res, "Failed to submit feedback"));
  return res.json();
}

export async function listFeedback(status: string = "open"): Promise<{ items: FeedbackItem[]; count: number }> {
  const res = await fetch(`${API_BASE}/feedback/list?status=${encodeURIComponent(status)}`, {
    signal: withTimeout(15000),
  });
  if (!res.ok) throw new Error(await safeJsonError(res, "Failed to load feedback"));
  return res.json();
}

export async function updateFeedbackStatus(id: string, status: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/feedback/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    signal: withTimeout(15000),
  });
  if (!res.ok) throw new Error(await safeJsonError(res, "Failed to update feedback"));
  return res.json();
}
