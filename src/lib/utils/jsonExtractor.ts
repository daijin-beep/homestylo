export function extractJson<T = Record<string, unknown>>(text: string): T {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? text).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("Model did not return valid JSON.");
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
}
