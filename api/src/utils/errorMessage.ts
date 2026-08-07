export function buildDetailedErrorMessage(context: string, error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return `${context}: ${fallback}`;

  const message = error.message.toLowerCase();
  let hint = "";

  if (message.includes("timeout")) {
    hint = "upstream request timed out";
  } else if (message.includes("unauthorized") || message.includes("forbidden") || message.includes("authentication")) {
    hint = "upstream authentication failed";
  } else if (message.includes("json") || message.includes("parse")) {
    hint = "upstream response format was invalid";
  } else if (message.includes("enotfound") || message.includes("dns")) {
    hint = "upstream service was unreachable";
  } else if (message && message !== fallback.toLowerCase()) {
    hint = "unexpected internal error";
  }

  if (!hint) return `${context}: ${fallback}`;
  return `${context}: ${fallback} (${hint})`;
}
