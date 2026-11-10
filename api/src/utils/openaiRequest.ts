interface CompletionOptions {
  max_completion_tokens: number;
  temperature: number;
  reasoning_effort?: "none";
}

export function completionOptions(
  deployment: string,
  maxCompletionTokens: number,
  temperature: number,
): CompletionOptions {
  return {
    max_completion_tokens: maxCompletionTokens,
    temperature,
    // Older deployments reject reasoning_effort during the deploy-to-flip window.
    ...(deployment === "gpt-6-luna" ? { reasoning_effort: "none" as const } : {}),
  };
}
