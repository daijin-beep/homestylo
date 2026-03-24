import "server-only";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 2000;

interface ReplicatePredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string;
}

interface ReplicateModelVersion {
  id: string;
  created_at?: string;
}

interface ReplicateVersionsResponse {
  results?: ReplicateModelVersion[];
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

function getReplicateHeaders(token: string, includeJson = false) {
  return {
    Authorization: `Token ${token}`,
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

function parseModelIdentifier(model: string) {
  const [owner, name, ...rest] = model.split("/");

  if (!owner || !name || rest.length > 0) {
    throw new Error(`Invalid Replicate model identifier: ${model}`);
  }

  return { owner, name };
}

async function createOfficialPrediction(
  token: string,
  model: string,
  input: Record<string, unknown>,
) {
  const { owner, name } = parseModelIdentifier(model);
  const response = await fetch(
    `${REPLICATE_API_BASE}/models/${owner}/${name}/predictions`,
    {
      method: "POST",
      headers: getReplicateHeaders(token, true),
      body: JSON.stringify({ input }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Replicate create prediction failed (official format, status ${response.status}): ${message}`,
    );
  }

  return (await response.json()) as ReplicatePredictionResponse;
}

async function getLatestModelVersion(token: string, model: string) {
  const { owner, name } = parseModelIdentifier(model);
  const response = await fetch(
    `${REPLICATE_API_BASE}/models/${owner}/${name}/versions`,
    {
      headers: getReplicateHeaders(token),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Replicate version lookup failed (status ${response.status}): ${message}`,
    );
  }

  const payload = (await response.json()) as ReplicateVersionsResponse;
  const versions = payload.results ?? [];

  if (versions.length === 0) {
    throw new Error(`Replicate version lookup returned no versions for model ${model}.`);
  }

  const latestVersion = [...versions].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  })[0];

  if (!latestVersion?.id) {
    throw new Error(`Replicate version lookup returned an invalid version for model ${model}.`);
  }

  return latestVersion.id;
}

async function createCommunityPrediction(
  token: string,
  model: string,
  input: Record<string, unknown>,
) {
  const version = await getLatestModelVersion(token, model);
  const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: getReplicateHeaders(token, true),
    body: JSON.stringify({ version, input }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Replicate create prediction failed (community format, status ${response.status}, version ${version}): ${message}`,
    );
  }

  return (await response.json()) as ReplicatePredictionResponse;
}

async function createPrediction(
  token: string,
  model: string,
  input: Record<string, unknown>,
) {
  try {
    return await createOfficialPrediction(token, model, input);
  } catch (officialError) {
    const officialMessage =
      officialError instanceof Error ? officialError.message : String(officialError);

    try {
      return await createCommunityPrediction(token, model, input);
    } catch (communityError) {
      const communityMessage =
        communityError instanceof Error ? communityError.message : String(communityError);

      throw new Error(
        `Replicate create prediction failed: ${officialMessage} | ${communityMessage}`,
      );
    }
  }
}

export async function runPrediction(
  model: string,
  input: Record<string, unknown>,
  timeoutMs = 90000,
): Promise<unknown> {
  const token = getReplicateToken();
  const startedAt = Date.now();
  const createdPrediction = await createPrediction(token, model, input);

  while (Date.now() - startedAt < timeoutMs) {
    const statusResponse = await fetch(
      `${REPLICATE_API_BASE}/predictions/${createdPrediction.id}`,
      {
        headers: getReplicateHeaders(token),
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
