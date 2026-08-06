export function buildDetailedErrorMessage(context: string, error: unknown, fallback: string): string {
  const detail = error instanceof Error ? error.message : "";
  if (!detail || detail === fallback) return `${context}: ${fallback}`;
  return `${context}: ${fallback} (${detail})`;
}
