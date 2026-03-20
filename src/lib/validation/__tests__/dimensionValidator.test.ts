import { describe, expect, test } from "vitest";
import {
  calculateLayoutMetrics,
  validateLayout,
  type FurnitureItem,
  type RoomDimensions,
} from "../dimensionValidator";

function createBaseRoom(overrides?: Partial<RoomDimensions>): RoomDimensions {
  return {
    sofaWallWidthMm: 3500,
    tvWallWidthMm: 3400,
    roomDepthMm: 4000,
    ceilingHeightMm: 2950,
    ...overrides,
  };
}

function createBaseFurniture(overrides?: Partial<Record<string, Partial<FurnitureItem>>>) {
  const sofa: FurnitureItem = {
    id: "sofa-1",
    name: "三人位沙发",
    category: "sofa",
    widthMm: 2400,
    depthMm: 950,
    heightMm: 820,
    placement: "sofa_wall",
    ...(overrides?.sofa ?? {}),
  };

  const tvCabinet: FurnitureItem = {
    id: "tv-1",
    name: "电视柜",
    category: "tv_cabinet",
    widthMm: 2200,
    depthMm: 450,
    heightMm: 560,
    placement: "tv_wall",
    ...(overrides?.tvCabinet ?? {}),
  };

  const coffeeTable: FurnitureItem = {
    id: "coffee-1",
    name: "茶几",
    category: "coffee_table",
    widthMm: 1300,
    depthMm: 600,
    heightMm: 420,
    placement: "center",
    ...(overrides?.coffeeTable ?? {}),
  };

  const rug: FurnitureItem = {
    id: "rug-1",
    name: "地毯",
    category: "rug",
    widthMm: 3000,
    depthMm: 2000,
    heightMm: 20,
    placement: "center",
    ...(overrides?.rug ?? {}),
  };

  return [sofa, tvCabinet, coffeeTable, rug];
}

function findRuleStatus(report: ReturnType<typeof validateLayout>, rule: string) {
  for (const item of report.items) {
    const match = item.checks.find((check) => check.rule === rule);
    if (match) {
      return match.status;
    }
  }

  return null;
}

describe("dimensionValidator", () => {
  test("正常布局（3500mm墙，2400mm沙发）返回 pass", () => {
    const report = validateLayout(createBaseRoom(), createBaseFurniture());

    expect(report.overallStatus).toBe("pass");
    expect(report.layoutMetrics.sofaWallOccupancy).toBeCloseTo(2400 / 3500, 4);
    expect(findRuleStatus(report, "sofa_wall_occupancy")).toBe("pass");
  });

  test("沙发过大（3500mm墙，3200mm沙发）返回 block", () => {
    const report = validateLayout(
      createBaseRoom(),
      createBaseFurniture({
        sofa: { widthMm: 3200 },
      }),
    );

    expect(report.overallStatus).toBe("block");
    expect(findRuleStatus(report, "sofa_wall_occupancy")).toBe("block");
  });

  test("茶几比例不对（2400mm沙发，1800mm茶几）返回 warning", () => {
    const report = validateLayout(
      createBaseRoom(),
      createBaseFurniture({
        coffeeTable: { widthMm: 1800 },
      }),
    );

    expect(report.overallStatus).toBe("warning");
    expect(findRuleStatus(report, "coffee_to_sofa_ratio")).toBe("warning");
  });

  test("通道过窄返回 block", () => {
    const room = createBaseRoom({ roomDepthMm: 2300 });
    const report = validateLayout(room, createBaseFurniture());
    const metrics = calculateLayoutMetrics(room, createBaseFurniture());

    expect(metrics.passageWidth).toBe(300);
    expect(findRuleStatus(report, "passage_width")).toBe("block");
    expect(report.overallStatus).toBe("block");
  });

  test("层高充裕返回 pass 且包含正面建议", () => {
    const report = validateLayout(
      createBaseRoom({ ceilingHeightMm: 3400 }),
      createBaseFurniture({
        sofa: { heightMm: 780 },
        tvCabinet: { heightMm: 520 },
        coffeeTable: { heightMm: 380 },
      }),
    );

    expect(report.overallStatus).toBe("pass");
    expect(
      report.suggestions.some((item) => item.includes("层高条件优秀")),
    ).toBe(true);
  });

  test("无进深数据时，距离规则返回 null 且不触发 block", () => {
    const report = validateLayout(
      createBaseRoom({ roomDepthMm: null }),
      createBaseFurniture(),
    );

    expect(report.layoutMetrics.sofaToTvDistance).toBeNull();
    expect(report.layoutMetrics.passageWidth).toBeNull();
    expect(findRuleStatus(report, "sofa_to_tv_distance")).toBeNull();
    expect(findRuleStatus(report, "passage_width")).toBeNull();
    expect(report.overallStatus).not.toBe("block");
  });
});
