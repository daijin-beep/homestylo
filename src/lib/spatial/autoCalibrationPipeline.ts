import "server-only";

import sharp from "sharp";
import { estimateDepthWithPro } from "@/lib/generation/depthEstimator";
import type { AnchorDetectionResult, CameraCalibrationData } from "@/lib/types";
import {
  calibrateFromAnchor,
  createFallbackCalibration,
} from "@/lib/spatial/cameraCalibrator";
import { detectAndStoreRoomAnchors } from "@/lib/spatial/anchorDetector";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function serializeCalibration(calibration: CameraCalibrationData) {
  return {
    K: calibration.K,
    scaleFactor: calibration.scaleFactor,
    focalLengthPx: calibration.focalLengthPx,
    imageWidth: calibration.imageWidth,
    imageHeight: calibration.imageHeight,
    calibrationSource: calibration.calibrationSource,
    estimatedAccuracy: calibration.estimatedAccuracy,
    fovYDeg: calibration.fovYDeg,
  } satisfies CameraCalibrationData;
}

async function getImageSize(imageUrl: string) {
  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const arrayBuffer = await response.arrayBuffer();
    const metadata = await sharp(Buffer.from(arrayBuffer)).metadata();

    return {
      width: metadata.width ?? 1024,
      height: metadata.height ?? 768,
    };
  } catch {
    return {
      width: 1024,
      height: 768,
    };
  }
}

/**
 * Automatic calibration pipeline: upload -> DepthPro -> anchors -> camera calibration.
 * Each step is best-effort so a partial result does not block the rest of the flow.
 */
export async function runAutoCalibration(roomId: string, imageUrl: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const imageSize = await getImageSize(imageUrl);
  let depthResult:
    | Awaited<ReturnType<typeof estimateDepthWithPro>>
    | null = null;
  let anchorResult: AnchorDetectionResult | null = null;

  try {
    depthResult = await estimateDepthWithPro(imageUrl, {
      planId: roomId,
      timeout: 90000,
    });

    const { error } = await supabase
      .from("rooms")
      .update({
        depth_map_url: depthResult.depthImageUrl,
        depth_raw_url: depthResult.depthRawUrl,
        focal_length_px: depthResult.focalLengthPx,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("[autoCalibrationPipeline] depth estimation failed", {
      roomId,
      imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    anchorResult = await detectAndStoreRoomAnchors(roomId, imageUrl);
  } catch (error) {
    console.error("[autoCalibrationPipeline] anchor detection failed", {
      roomId,
      imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const focalLengthPx =
      depthResult?.focalLengthPx ?? imageSize.width * 1.2;

    const calibration =
      depthResult?.depthImageUrl && anchorResult?.bestAnchor
        ? await calibrateFromAnchor(
            depthResult.depthImageUrl,
            focalLengthPx,
            imageSize.width,
            imageSize.height,
            anchorResult.bestAnchor,
          )
        : createFallbackCalibration(imageSize.width, imageSize.height, focalLengthPx);

    const calibrationData = serializeCalibration(calibration);
    const { error } = await supabase
      .from("rooms")
      .update({
        camera_calibration: calibrationData,
        calibration_source: calibrationData.calibrationSource,
        calibration_accuracy: calibrationData.estimatedAccuracy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("[autoCalibrationPipeline] camera calibration failed", {
      roomId,
      imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
