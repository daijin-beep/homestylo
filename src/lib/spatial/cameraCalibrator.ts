import "server-only";

import sharp from "sharp";
import type {
  CalibrationSource,
  CameraCalibrationData,
  SemanticAnchor,
  Vec2px,
  Vec3mm,
} from "@/lib/types";

export interface CameraCalibration extends CameraCalibrationData {
  projectToPixel(point3d: Vec3mm): Vec2px | null;
  backprojectToWorld(px: number, py: number, depthMeters: number): Vec3mm;
}

const DEFAULT_DEPTH_RANGE_METERS = {
  near: 0.5,
  far: 6,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function grayscaleToDepthMeters(value: number) {
  const normalized = clamp(value / 255, 0, 1);
  return (
    DEFAULT_DEPTH_RANGE_METERS.near
    + normalized * (DEFAULT_DEPTH_RANGE_METERS.far - DEFAULT_DEPTH_RANGE_METERS.near)
  );
}

function resolveCalibrationSource(anchor: SemanticAnchor): CalibrationSource {
  switch (anchor.type) {
    case "door":
      return "door";
    case "ceiling_height":
      return "ceiling";
    default:
      return "user_wall";
  }
}

async function readDepthPixels(depthImageUrl: string) {
  const response = await fetch(depthImageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Failed to download depth image: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const { data, info } = await sharp(Buffer.from(arrayBuffer))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
  };
}

function sampleDepthAtPixel(
  depthPixels: Uint8Array | Buffer,
  width: number,
  height: number,
  point: Vec2px,
) {
  const centerX = clamp(Math.round(point.x), 0, width - 1);
  const centerY = clamp(Math.round(point.y), 0, height - 1);
  const samples: number[] = [];

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const x = clamp(centerX + offsetX, 0, width - 1);
      const y = clamp(centerY + offsetY, 0, height - 1);
      samples.push(depthPixels[y * width + x] ?? 0);
    }
  }

  const averageGrayscale =
    samples.reduce((sum, sample) => sum + sample, 0) / Math.max(samples.length, 1);
  return grayscaleToDepthMeters(averageGrayscale);
}

function createCalibrationObject(data: CameraCalibrationData): CameraCalibration {
  const focalLengthPx = data.focalLengthPx;
  const cx = data.imageWidth / 2;
  const cy = data.imageHeight / 2;

  return {
    ...data,
    projectToPixel(point3d: Vec3mm) {
      const zMeters = point3d.z / 1000;
      if (Math.abs(zMeters) < 1e-6) {
        return null;
      }

      const px = focalLengthPx * (point3d.x / 1000) / zMeters + cx;
      const py = focalLengthPx * (point3d.y / 1000) / zMeters + cy;

      return {
        x: Math.round(px),
        y: Math.round(py),
      };
    },
    backprojectToWorld(px: number, py: number, depthMeters: number) {
      const scaledDepthMeters = depthMeters * data.scaleFactor;

      return {
        x: ((px - cx) * scaledDepthMeters * 1000) / focalLengthPx,
        y: ((py - cy) * scaledDepthMeters * 1000) / focalLengthPx,
        z: scaledDepthMeters * 1000,
      };
    },
  };
}

export function rebuildCalibration(data: CameraCalibrationData): CameraCalibration {
  return createCalibrationObject(data);
}

export function createFallbackCalibration(
  imageWidth: number,
  imageHeight: number,
  focalLengthPx: number,
): CameraCalibration {
  const fallbackDepthMeters = 4;
  const fallbackData: CameraCalibrationData = {
    K: [
      [focalLengthPx, 0, imageWidth / 2],
      [0, focalLengthPx, imageHeight / 2],
      [0, 0, 1],
    ],
    scaleFactor: 1,
    focalLengthPx,
    imageWidth,
    imageHeight,
    calibrationSource: "user_wall",
    estimatedAccuracy: 0.2,
    fovYDeg: (2 * Math.atan(imageHeight / (2 * focalLengthPx)) * 180) / Math.PI,
  };

  const calibration = createCalibrationObject(fallbackData);

  return {
    ...calibration,
    backprojectToWorld(px: number, py: number) {
      return calibration.backprojectToWorld(px, py, fallbackDepthMeters);
    },
  };
}

export async function calibrateFromAnchor(
  depthImageUrl: string,
  focalLengthPx: number,
  imageWidth: number,
  imageHeight: number,
  anchor: SemanticAnchor,
): Promise<CameraCalibration> {
  const depthPixels = await readDepthPixels(depthImageUrl);
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;

  const startPoint: Vec2px =
    anchor.measureDirection === "horizontal"
      ? {
          x: anchor.pixelBounds.topLeft.x,
          y: Math.round((anchor.pixelBounds.topLeft.y + anchor.pixelBounds.bottomRight.y) / 2),
        }
      : {
          x: Math.round((anchor.pixelBounds.topLeft.x + anchor.pixelBounds.bottomRight.x) / 2),
          y: anchor.pixelBounds.topLeft.y,
        };

  const endPoint: Vec2px =
    anchor.measureDirection === "horizontal"
      ? {
          x: anchor.pixelBounds.bottomRight.x,
          y: Math.round((anchor.pixelBounds.topLeft.y + anchor.pixelBounds.bottomRight.y) / 2),
        }
      : {
          x: Math.round((anchor.pixelBounds.topLeft.x + anchor.pixelBounds.bottomRight.x) / 2),
          y: anchor.pixelBounds.bottomRight.y,
        };

  const startDepthMeters = sampleDepthAtPixel(
    depthPixels.data,
    depthPixels.width,
    depthPixels.height,
    startPoint,
  );
  const endDepthMeters = sampleDepthAtPixel(
    depthPixels.data,
    depthPixels.width,
    depthPixels.height,
    endPoint,
  );

  const toUnscaledPoint = (point: Vec2px, depthMeters: number) => ({
    x: ((point.x - cx) * depthMeters) / focalLengthPx,
    y: ((point.y - cy) * depthMeters) / focalLengthPx,
    z: depthMeters,
  });

  const pointA = toUnscaledPoint(startPoint, startDepthMeters);
  const pointB = toUnscaledPoint(endPoint, endDepthMeters);
  const distanceMeters = Math.sqrt(
    (pointA.x - pointB.x) ** 2
      + (pointA.y - pointB.y) ** 2
      + (pointA.z - pointB.z) ** 2,
  );

  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    throw new Error("Anchor calibration failed because the sampled 3D distance is invalid.");
  }

  const scaleFactor = anchor.knownSizeMm / (distanceMeters * 1000);
  const calibrationData: CameraCalibrationData = {
    K: [
      [focalLengthPx, 0, cx],
      [0, focalLengthPx, cy],
      [0, 0, 1],
    ],
    scaleFactor,
    focalLengthPx,
    imageWidth,
    imageHeight,
    calibrationSource: resolveCalibrationSource(anchor),
    estimatedAccuracy: clamp(anchor.confidence, 0.2, 0.98),
    fovYDeg: (2 * Math.atan(imageHeight / (2 * focalLengthPx)) * 180) / Math.PI,
  };

  return createCalibrationObject(calibrationData);
}
