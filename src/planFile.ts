const PLAN_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
export const MAX_PLAN_BYTES = 10 * 1024 * 1024;

export function validatePlanFile(file: Pick<File, "size" | "type">): string | null {
  if (!PLAN_TYPES.has(file.type)) return "Choose a PNG, JPEG, WebP or PDF floor plan.";
  if (file.size === 0) return "This file is empty. Choose a floor plan with visible room labels.";
  if (file.size > MAX_PLAN_BYTES) return "This file is larger than 10 MB. Choose a smaller version; your current plan has not changed.";
  return null;
}
