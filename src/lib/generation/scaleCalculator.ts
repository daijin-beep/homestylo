export interface ScaleCalculatorInput {
  roomWidthMm: number;
  roomPhotoWidthPx: number;
  roomPhotoHeightPx: number;
  furnitureWidthMm: number;
  furnitureHeightMm: number;
  furnitureDepthMm: number;
  placementX: number;
  placementY: number;
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
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ensurePositiveInteger(value: number) {
  return Math.max(1, Math.round(value));
}

export function calculateScale(input: ScaleCalculatorInput): ScaleResult {
  if (input.roomWidthMm <= 0 || input.roomPhotoWidthPx <= 0 || input.roomPhotoHeightPx <= 0) {
    throw new Error("Room dimensions for scale calculation must be greater than zero.");
  }

  if (input.furnitureWidthMm <= 0 || input.furnitureHeightMm <= 0 || input.furnitureDepthMm <= 0) {
    throw new Error("Furniture dimensions for scale calculation must be greater than zero.");
  }

  const placementX = clamp(input.placementX, 0, 1);
  const placementY = clamp(input.placementY, 0, 1);
  const wallToPhotoRatio = input.roomWidthMm / input.roomPhotoWidthPx;
  const furnitureToWallRatio = input.furnitureWidthMm / input.roomWidthMm;
  const basePixelWidth = input.furnitureWidthMm / wallToPhotoRatio;
  const basePixelHeight = input.furnitureHeightMm / wallToPhotoRatio;
  const perspectiveScale = 1 - placementY * 0.3;
  const pixelWidth = ensurePositiveInteger(basePixelWidth * perspectiveScale);
  const pixelHeight = ensurePositiveInteger(basePixelHeight * perspectiveScale);

  const rawPositionX = (input.roomPhotoWidthPx - pixelWidth) * placementX;
  const rawPositionY =
    input.roomPhotoHeightPx -
    pixelHeight -
    placementY * input.roomPhotoHeightPx * 0.3;

  const positionX = Math.round(
    clamp(rawPositionX, 0, Math.max(input.roomPhotoWidthPx - pixelWidth, 0)),
  );
  const positionY = Math.round(
    clamp(rawPositionY, 0, Math.max(input.roomPhotoHeightPx - pixelHeight, 0)),
  );

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
    },
  };
}
