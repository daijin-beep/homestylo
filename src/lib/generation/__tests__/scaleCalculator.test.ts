import { describe, expect, test } from "vitest";
import { calculateScale } from "../scaleCalculator";

describe("calculateScale", () => {
  test("3000mm 墙面中 2600mm 沙发约占 1040px", () => {
    const result = calculateScale({
      roomWidthMm: 3000,
      roomPhotoWidthPx: 1200,
      roomPhotoHeightPx: 900,
      furnitureWidthMm: 2600,
      furnitureHeightMm: 850,
      furnitureDepthMm: 950,
      placementX: 0.5,
      placementY: 0,
    });

    expect(result.pixelWidth).toBe(1040);
    expect(result.debug.wallToPhotoRatio).toBeCloseTo(2.5, 4);
    expect(result.positionX).toBe(80);
  });

  test("更远处的家具应该更小", () => {
    const near = calculateScale({
      roomWidthMm: 3600,
      roomPhotoWidthPx: 1400,
      roomPhotoHeightPx: 960,
      furnitureWidthMm: 1800,
      furnitureHeightMm: 900,
      furnitureDepthMm: 800,
      placementX: 0.5,
      placementY: 0,
    });

    const far = calculateScale({
      roomWidthMm: 3600,
      roomPhotoWidthPx: 1400,
      roomPhotoHeightPx: 960,
      furnitureWidthMm: 1800,
      furnitureHeightMm: 900,
      furnitureDepthMm: 800,
      placementX: 0.5,
      placementY: 1,
    });

    expect(far.pixelWidth).toBeLessThan(near.pixelWidth);
    expect(far.pixelHeight).toBeLessThan(near.pixelHeight);
    expect(far.perspectiveScale).toBeLessThan(near.perspectiveScale);
  });

  test("家具比墙更宽时返回 warning", () => {
    const result = calculateScale({
      roomWidthMm: 2600,
      roomPhotoWidthPx: 1000,
      roomPhotoHeightPx: 800,
      furnitureWidthMm: 3000,
      furnitureHeightMm: 900,
      furnitureDepthMm: 1000,
      placementX: 0.5,
      placementY: 0.1,
    });

    expect(result.warning).toBeTruthy();
    expect(result.debug.furnitureToWallRatio).toBeGreaterThan(1);
  });

  test("居中、靠左、靠右放置的 X 坐标应不同", () => {
    const left = calculateScale({
      roomWidthMm: 3200,
      roomPhotoWidthPx: 1200,
      roomPhotoHeightPx: 900,
      furnitureWidthMm: 1200,
      furnitureHeightMm: 700,
      furnitureDepthMm: 700,
      placementX: 0,
      placementY: 0.3,
    });

    const center = calculateScale({
      roomWidthMm: 3200,
      roomPhotoWidthPx: 1200,
      roomPhotoHeightPx: 900,
      furnitureWidthMm: 1200,
      furnitureHeightMm: 700,
      furnitureDepthMm: 700,
      placementX: 0.5,
      placementY: 0.3,
    });

    const right = calculateScale({
      roomWidthMm: 3200,
      roomPhotoWidthPx: 1200,
      roomPhotoHeightPx: 900,
      furnitureWidthMm: 1200,
      furnitureHeightMm: 700,
      furnitureDepthMm: 700,
      placementX: 1,
      placementY: 0.3,
    });

    expect(left.positionX).toBeLessThan(center.positionX);
    expect(center.positionX).toBeLessThan(right.positionX);
  });
});
