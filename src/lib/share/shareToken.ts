import type { ShareType } from "@/lib/types";
import { resolveShareType } from "@/lib/share/shareData";

const COMPATIBILITY_SHARE_PREFIX = "compat-";

interface CompatibilitySharePayload {
  v: 1;
  schemeId: string;
  shareType: ShareType;
  issuedAt: string;
}

export function createCompatibilityShareId(schemeId: string, shareType: ShareType) {
  const payload: CompatibilitySharePayload = {
    v: 1,
    schemeId,
    shareType,
    issuedAt: new Date().toISOString(),
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${COMPATIBILITY_SHARE_PREFIX}${encoded}`;
}

export function parseCompatibilityShareId(shareId: string) {
  if (!shareId.startsWith(COMPATIBILITY_SHARE_PREFIX)) {
    return null;
  }

  try {
    const encoded = shareId.slice(COMPATIBILITY_SHARE_PREFIX.length);
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<CompatibilitySharePayload>;
    const shareType = resolveShareType(parsed.shareType);

    if (parsed.v !== 1 || !parsed.schemeId || !shareType) {
      return null;
    }

    return {
      schemeId: parsed.schemeId,
      shareType,
      issuedAt: typeof parsed.issuedAt === "string" ? parsed.issuedAt : null,
    };
  } catch {
    return null;
  }
}
