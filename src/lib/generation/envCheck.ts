import "server-only";

const REQUIRED_GENERATION_ENV = [
  "REPLICATE_API_TOKEN",
  "ANTHROPIC_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
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

export type RenderPipelineMode = "route_d" | "route_e";

export function resolveRenderPipeline(): RenderPipelineMode {
  const raw = process.env.RENDER_PIPELINE?.trim().toLowerCase();

  if (!raw || raw === "route_e") {
    return "route_e";
  }

  if (raw === "route_d") {
    return "route_d";
  }

  console.warn(`[generation] Invalid RENDER_PIPELINE value "${raw}", falling back to route_e.`);
  return "route_e";
}

export function isIcLightEnabled() {
  return process.env.ENABLE_IC_LIGHT?.trim().toLowerCase() === "true";
}
