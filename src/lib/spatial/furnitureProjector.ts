import "server-only";

import sharp from "sharp";
import type { FurnitureBBox3D, ProjectionResult, Vec2px, Vec3mm } from "@/lib/types";
import type { CameraCalibration } from "@/lib/spatial/cameraCalibrator";

export const DEFAULT_POSITIONS: Record<string, Vec3mm> = {
  sofa: { x: 0, y: 0, z: 2000 },
  coffee_table: { x: 0, y: 0, z: 2500 },
  tv_cabinet: { x: 0, y: 0, z: 500 },
  bed: { x: 0, y: 0, z: 1800 },
  dining_table: { x: 0, y: 0, z: 2200 },
  floor_lamp: { x: 800, y: 0, z: 1800 },
  side_table: { x: -700, y: 0, z: 2200 },
  rug: { x: 0, y: 0, z: 2100 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function grayscaleToDepthMeters(value: number) {
  return 0.5 + (clamp(value, 0, 255) / 255) * 5.5;
}

export function getDefaultPositionForCategory(category: string): Vec3mm {
  return DEFAULT_POSITIONS[category] ?? { x: 0, y: 0, z: 2000 };
}

function rotatePointY(point: Vec3mm, rotationY: number): Vec3mm {
  const radians = (rotationY * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos + point.z * sin,
    y: point.y,
    z: -point.x * sin + point.z * cos,
  };
}

function getFurnitureVertices(furniture: FurnitureBBox3D): Vec3mm[] {
  const halfWidth = furniture.width / 2;
  const halfDepth = furniture.depth / 2;
  const halfHeight = furniture.height / 2;
  const offsets: Vec3mm[] = [
    { x: -halfWidth, y: -halfHeight, z: -halfDepth },
    { x: halfWidth, y: -halfHeight, z: -halfDepth },
    { x: -halfWidth, y: halfHeight, z: -halfDepth },
    { x: halfWidth, y: halfHeight, z: -halfDepth },
    { x: -halfWidth, y: -halfHeight, z: halfDepth },
    { x: halfWidth, y: -halfHeight, z: halfDepth },
    { x: -halfWidth, y: halfHeight, z: halfDepth },
    { x: halfWidth, y: halfHeight, z: halfDepth },
  ];

  return offsets.map((offset) => {
    const rotated = rotatePointY(offset, furniture.rotationY);
    return {
      x: furniture.center.x + rotated.x,
      y: furniture.center.y + rotated.y,
      z: furniture.center.z + rotated.z,
    };
  });
}

async function createRectMaskBuffer(
  imageWidth: number,
  imageHeight: number,
  topLeft: Vec2px,
  width: number,
  height: number,
) {
  const svg = `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${topLeft.x}" y="${topLeft.y}" width="${width}" height="${height}" fill="white" />
    </svg>
  `;

  return sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function projectFurnitureMask(
  calibration: CameraCalibration,
  furniture: FurnitureBBox3D,
  imageWidth: number,
  imageHeight: number,
): Promise<ProjectionResult> {
  const projectedPoints = getFurnitureVertices(furniture)
    .map((vertex) => calibration.projectToPixel(vertex))
    .filter((point): point is Vec2px => point !== null);

  if (projectedPoints.length === 0) {
    const maskBuffer = await createRectMaskBuffer(imageWidth, imageHeight, { x: 0, y: 0 }, 1, 1);
    return {
      maskBuffer,
      boundingRect: { x: 0, y: 0, width: 1, height: 1 },
      wallWidthPercent: 0,
      isClipped: true,
    };
  }

  const unclippedMinX = Math.min(...projectedPoints.map((point) => point.x));
  const unclippedMaxX = Math.max(...projectedPoints.map((point) => point.x));
  const unclippedMinY = Math.min(...projectedPoints.map((point) => point.y));
  const unclippedMaxY = Math.max(...projectedPoints.map((point) => point.y));

  const minX = clamp(Math.floor(unclippedMinX), 0, imageWidth - 1);
  const maxX = clamp(Math.ceil(unclippedMaxX), 0, imageWidth - 1);
  const minY = clamp(Math.floor(unclippedMinY), 0, imageHeight - 1);
  const maxY = clamp(Math.ceil(unclippedMaxY), 0, imageHeight - 1);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const isClipped =
    unclippedMinX < 0
    || unclippedMaxX > imageWidth - 1
    || unclippedMinY < 0
    || unclippedMaxY > imageHeight - 1;

  const maskBuffer = await createRectMaskBuffer(
    imageWidth,
    imageHeight,
    { x: minX, y: minY },
    width,
    height,
  );

  return {
    maskBuffer,
    boundingRect: {
      x: minX,
      y: minY,
      width,
      height,
    },
    wallWidthPercent: Number(((width / imageWidth) * 100).toFixed(2)),
    isClipped,
  };
}

export async function projectMultipleFurniture(
  calibration: CameraCalibration,
  furniture: FurnitureBBox3D[],
  imageWidth: number,
  imageHeight: number,
): Promise<{
  combinedMaskBuffer: Buffer;
  individualResults: ProjectionResult[];
}> {
  const individualResults = await Promise.all(
    furniture.map((item) =>
      projectFurnitureMask(calibration, item, imageWidth, imageHeight),
    ),
  );

  const combinedMaskBuffer = await sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(
      individualResults.map((result) => ({
        input: result.maskBuffer,
        blend: "lighten",
      })),
    )
    .png()
    .toBuffer();

  return {
    combinedMaskBuffer,
    individualResults,
  };
}

export function backprojectPixelToFloor(
  calibration: CameraCalibration,
  depthMap: Buffer,
  depthWidth: number,
  depthHeight: number,
  pixelX: number,
  pixelY: number,
): Vec3mm {
  const centerX = clamp(Math.round(pixelX), 0, depthWidth - 1);
  const centerY = clamp(Math.round(pixelY), 0, depthHeight - 1);
  const samples: number[] = [];

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const x = clamp(centerX + offsetX, 0, depthWidth - 1);
      const y = clamp(centerY + offsetY, 0, depthHeight - 1);
      samples.push(depthMap[y * depthWidth + x] ?? 0);
    }
  }

  const averageDepthMeters = grayscaleToDepthMeters(
    samples.reduce((sum, sample) => sum + sample, 0) / Math.max(samples.length, 1),
  );
  const worldPoint = calibration.backprojectToWorld(pixelX, pixelY, averageDepthMeters);

  return {
    ...worldPoint,
    y: 0,
  };
}
