const API_BASE = "/api";

export async function uploadFile(file: File): Promise<{ id: string; url: string; blobName: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
  return res.json();
}

export async function analyzeFloorPlan(imageUrl: string, propertyType: string): Promise<any> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, propertyType }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Analysis failed");
  return res.json();
}

export async function getStandards(countryCode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/standards/${countryCode}`);
  if (!res.ok) throw new Error((await res.json()).error || "Standards not found");
  return res.json();
}

export async function getCountries(): Promise<{ countries: { code: string; country: string }[] }> {
  const res = await fetch(`${API_BASE}/standards`);
  if (!res.ok) throw new Error("Failed to load countries");
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
  });
  if (!res.ok) throw new Error((await res.json()).error || "Calculation failed");
  return res.json();
}

export async function generateDescription(
  rooms: any[],
  placements: any,
  countryCode: string,
  propertyType: string
): Promise<{ description: string }> {
  const res = await fetch(`${API_BASE}/generate-description`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rooms, placements, countryCode, propertyType }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Description generation failed");
  return res.json();
}
