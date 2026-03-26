import "server-only";

export interface OutputCandidate {
  url: string | null;
  base64: string | null;
  mimeType: string;
  filename: string | null;
}

const DEFAULT_OUTPUT_KEYS = [
  "url",
  "image",
  "images",
  "output",
  "prediction",
  "result",
  "data",
  "mask",
  "base64",
];

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function inferFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").pop() || null;
  } catch {
    return null;
  }
}

function extractStringPayload(value: string): OutputCandidate | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isHttpUrl(trimmed)) {
    return {
      url: trimmed,
      base64: null,
      mimeType: "image/png",
      filename: inferFileNameFromUrl(trimmed),
    };
  }

  const dataUriMatch = trimmed.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (dataUriMatch?.[2]) {
    return {
      url: null,
      base64: dataUriMatch[2],
      mimeType: dataUriMatch[1] ?? "image/png",
      filename: null,
    };
  }

  const likelyBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64;
  if (likelyBase64) {
    return {
      url: null,
      base64: trimmed.replace(/\s+/g, ""),
      mimeType: "image/png",
      filename: null,
    };
  }

  return null;
}

export function extractOutputCandidate(
  output: unknown,
  preferredKeys: string[] = DEFAULT_OUTPUT_KEYS,
): OutputCandidate | null {
  if (typeof output === "string") {
    return extractStringPayload(output);
  }

  if (Array.isArray(output)) {
    for (const entry of output) {
      const candidate = extractOutputCandidate(entry, preferredKeys);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;

    for (const key of preferredKeys) {
      if (!(key in record)) {
        continue;
      }

      const candidate = extractOutputCandidate(record[key], preferredKeys);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export async function downloadModelOutput(output: unknown) {
  const candidate = extractOutputCandidate(output);
  if (!candidate) {
    throw new Error("Replicate output format is not supported.");
  }

  if (candidate.url) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to download Replicate output: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") || candidate.mimeType,
      filename: candidate.filename,
    };
  }

  if (!candidate.base64) {
    throw new Error("Replicate output did not contain image data.");
  }

  return {
    buffer: Buffer.from(candidate.base64, "base64"),
    mimeType: candidate.mimeType,
    filename: candidate.filename,
  };
}

export async function downloadModelImage(output: unknown) {
  const { buffer } = await downloadModelOutput(output);
  return buffer;
}
