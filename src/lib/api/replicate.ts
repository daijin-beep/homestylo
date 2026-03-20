import "server-only";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 2000;

interface ReplicatePredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string;
}

interface RunPredictionWithRetryOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getReplicateToken() {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    throw new Error("Missing REPLICATE_API_TOKEN.");
  }

  return token;
}

export async function runPrediction(
  model: string,
  input: Record<string, unknown>,
  timeoutMs = 90000,
): Promise<unknown> {
  const token = getReplicateToken();
  const startedAt = Date.now();

  const createResponse = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
    cache: "no-store",
  });

  if (!createResponse.ok) {
    const message = await createResponse.text();
    throw new Error(`Replicate create prediction failed: ${message}`);
  }

  const createdPrediction =
    (await createResponse.json()) as ReplicatePredictionResponse;

  while (Date.now() - startedAt < timeoutMs) {
    const statusResponse = await fetch(
      `${REPLICATE_API_BASE}/predictions/${createdPrediction.id}`,
      {
        headers: {
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!statusResponse.ok) {
      const message = await statusResponse.text();
      throw new Error(`Replicate poll failed: ${message}`);
    }

    const status =
      (await statusResponse.json()) as ReplicatePredictionResponse;

    if (status.status === "succeeded") {
      return status.output;
    }

    if (status.status === "failed" || status.status === "canceled") {
      throw new Error(status.error ?? "Replicate prediction failed.");
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Replicate prediction timeout exceeded.");
}

function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const networkLike =
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("socket") ||
    message.includes("econn") ||
    message.includes("enotfound") ||
    message.includes("aborted");
  const modelFailed =
    message.includes("prediction failed") ||
    message.includes("replicate create prediction failed") ||
    message.includes("replicate poll failed:");

  return networkLike && !modelFailed;
}

export async function runPredictionWithRetry(
  model: string,
  input: Record<string, unknown>,
  options?: RunPredictionWithRetryOptions,
): Promise<unknown> {
  const timeoutMs = options?.timeout ?? 90000;
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 3000;
  let attempts = 0;

  while (attempts <= maxRetries) {
    try {
      return await runPrediction(model, input, timeoutMs);
    } catch (error) {
      if (attempts >= maxRetries || !isRetryableError(error)) {
        throw error;
      }

      attempts += 1;
      await sleep(retryDelayMs);
    }
  }

  throw new Error("Replicate prediction retry exhausted.");
}
