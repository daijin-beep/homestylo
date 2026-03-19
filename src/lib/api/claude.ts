import "server-only";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface ClaudeTextContent {
  type: "text";
  text: string;
}

interface ClaudeResponse {
  content?: ClaudeTextContent[];
  error?: {
    message?: string;
  };
}

function getAnthropicApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }

  return key;
}

export async function analyzeImage(
  imageUrl: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = getAnthropicApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "url",
                  url: imageUrl,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = (await response.json()) as ClaudeResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Claude Vision request failed.");
    }

    const content = payload.content ?? [];
    const combinedText = content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!combinedText) {
      throw new Error("Claude Vision returned empty text.");
    }

    return combinedText;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Claude Vision request timed out after 30 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
