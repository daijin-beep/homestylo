export interface ScaleInput {
  roomWidthMm: number;
  roomPhotoWidthPx: number;
  roomPhotoHeightPx: number;
  furnitureWidthMm: number;
  furnitureHeightMm: number;
  placementX: number;
  placementY: number;
  depthAtPlacement?: number;
  depthAtWall?: number;
}

export interface ScaleResult {
  pixelWidth: number;
  pixelHeight: number;
  positionX: number;
  positionY: number;
  perspectiveScale: number;
  warning?: string | null;
  debug: {
    wallToPhotoRatio: number;
    furnitureToWallRatio: number;
    depthRatio: number | null;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ensurePositiveInteger(value: number) {
  return Math.max(1, Math.round(value));
}

function resolvePerspectiveScale(input: ScaleInput) {
  const hasDepth =
    typeof input.depthAtPlacement === "number" &&
    Number.isFinite(input.depthAtPlacement) &&
    input.depthAtPlacement > 0 &&
    typeof input.depthAtWall === "number" &&
    Number.isFinite(input.depthAtWall) &&
    input.depthAtWall > 0;

  if (hasDepth) {
    const depthRatio = input.depthAtWall! / input.depthAtPlacement!;
    const perspectiveScale = Math.max(0.5, clamp(depthRatio, 0.4, 1.2));

    return {
      perspectiveScale,
      depthRatio,
    };
  }

  return {
    perspectiveScale: Math.max(
      0.5,
      1.0 - (1.0 - clamp(input.placementY, 0, 1)) * 0.35,
    ),
    depthRatio: null,
  };
}

export function calculateScaleRouteE(input: ScaleInput): ScaleResult {
  if (input.roomWidthMm <= 0 || input.roomPhotoWidthPx <= 0 || input.roomPhotoHeightPx <= 0) {
    throw new Error("Room dimensions for scale calculation must be greater than zero.");
  }

  if (input.furnitureWidthMm <= 0 || input.furnitureHeightMm <= 0) {
    throw new Error("Furniture dimensions for scale calculation must be greater than zero.");
  }

  const placementX = clamp(input.placementX, 0, 1);
  const placementY = clamp(input.placementY, 0, 1);
  const wallToPhotoRatio = input.roomWidthMm / input.roomPhotoWidthPx;
  const furnitureToWallRatio = input.furnitureWidthMm / input.roomWidthMm;
  const basePixelWidth = input.furnitureWidthMm / wallToPhotoRatio;
  const basePixelHeight = input.furnitureHeightMm / wallToPhotoRatio;
  const { perspectiveScale, depthRatio } = resolvePerspectiveScale(input);

  const pixelWidth = ensurePositiveInteger(basePixelWidth * perspectiveScale);
  const pixelHeight = ensurePositiveInteger(basePixelHeight * perspectiveScale);
  const rawPositionX = (input.roomPhotoWidthPx - pixelWidth) * placementX;
  const groundY =
    input.roomPhotoHeightPx -
    pixelHeight -
    ((1 - placementY) * input.roomPhotoHeightPx * 0.4);

  const positionX = Math.round(
    clamp(rawPositionX, 0, Math.max(input.roomPhotoWidthPx - pixelWidth, 0)),
  );
  const positionY = Math.round(
    clamp(groundY, 0, Math.max(input.roomPhotoHeightPx - pixelHeight, 0)),
  );
  const minimumReasonableWidth = input.roomPhotoWidthPx * 0.05;

  console.log("[scaleCalculatorRouteE] calculation", {
    roomWidthMm: input.roomWidthMm,
    roomPhotoWidthPx: input.roomPhotoWidthPx,
    furnitureWidthMm: input.furnitureWidthMm,
    furnitureHeightMm: input.furnitureHeightMm,
    placementX,
    placementY,
    depthAtPlacement: input.depthAtPlacement ?? null,
    depthAtWall: input.depthAtWall ?? null,
    wallToPhotoRatio,
    basePixelWidth,
    perspectiveScale,
    pixelWidth,
    pixelHeight,
    positionX,
    positionY,
  });

  if (pixelWidth < minimumReasonableWidth) {
    console.warn("[scaleCalculatorRouteE] suspiciously small furniture width", {
      pixelWidth,
      minimumReasonableWidth,
      roomPhotoWidthPx: input.roomPhotoWidthPx,
      roomWidthMm: input.roomWidthMm,
      furnitureWidthMm: input.furnitureWidthMm,
      placementY,
      perspectiveScale,
    });
  }

  return {
    pixelWidth,
    pixelHeight,
    positionX,
    positionY,
    perspectiveScale,
    warning:
      furnitureToWallRatio > 1
        ? "Furniture width exceeds wall width and may need manual adjustment."
        : null,
    debug: {
      wallToPhotoRatio,
      furnitureToWallRatio,
      depthRatio,
    },
  };
}
