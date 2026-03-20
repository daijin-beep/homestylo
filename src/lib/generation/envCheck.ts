import "server-only";

const REQUIRED_GENERATION_ENV = [
  "REPLICATE_API_TOKEN",
  "ANTHROPIC_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET_NAME",
] as const;

export function checkGenerationEnv() {
  const missing = REQUIRED_GENERATION_ENV.filter((key) => {
    const value = process.env[key];
    return !value || !value.trim();
  });

  return {
    ready: missing.length === 0,
    missing,
  };
}

