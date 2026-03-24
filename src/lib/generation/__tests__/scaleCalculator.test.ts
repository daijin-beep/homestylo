import { describe, expect, test } from "vitest";
import { calculateScale } from "../scaleCalculator";
import { calculateScaleRouteE } from "../scaleCalculatorRouteE";

describe("calculateScale", () => {
  test("legacy calculator keeps the original sofa width projection", () => {
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

  test("legacy calculator makes farther objects smaller", () => {
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

  test("legacy calculator returns a warning when furniture is wider than the wall", () => {
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

  test("legacy calculator changes X position when placing left, center and right", () => {
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

describe("calculateScaleRouteE", () => {
  test("uses depth ratio when depth values are available", () => {
    const near = calculateScaleRouteE({
      roomWidthMm: 3600,
      roomPhotoWidthPx: 1440,
      roomPhotoHeightPx: 1024,
      furnitureWidthMm: 2000,
      furnitureHeightMm: 900,
      placementX: 0.5,
      placementY: 0.86,
      depthAtPlacement: 0.45,
      depthAtWall: 0.52,
    });

    const far = calculateScaleRouteE({
      roomWidthMm: 3600,
      roomPhotoWidthPx: 1440,
      roomPhotoHeightPx: 1024,
      furnitureWidthMm: 2000,
      furnitureHeightMm: 900,
      placementX: 0.5,
      placementY: 0.24,
      depthAtPlacement: 0.88,
      depthAtWall: 0.52,
    });

    expect(near.debug.depthRatio).toBeCloseTo(0.52 / 0.45, 4);
    expect(far.debug.depthRatio).toBeCloseTo(0.52 / 0.88, 4);
    expect(far.pixelWidth).toBeLessThan(near.pixelWidth);
    expect(far.perspectiveScale).toBeLessThan(near.perspectiveScale);
  });

  test("falls back to the legacy placement formula when depth data is missing", () => {
    const result = calculateScaleRouteE({
      roomWidthMm: 3200,
      roomPhotoWidthPx: 1280,
      roomPhotoHeightPx: 960,
      furnitureWidthMm: 1600,
      furnitureHeightMm: 820,
      placementX: 0.35,
      placementY: 0.2,
    });

    expect(result.debug.depthRatio).toBeNull();
    expect(result.perspectiveScale).toBeCloseTo(1 - (1 - 0.2) * 0.35, 4);
    expect(result.positionY).toBeGreaterThanOrEqual(0);
    expect(result.positionY).toBeLessThan(960);
  });
});
