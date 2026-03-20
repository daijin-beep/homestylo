export interface RoomDimensions {
  sofaWallWidthMm: number;
  tvWallWidthMm: number;
  roomDepthMm: number | null;
  ceilingHeightMm: number | null;
}

export interface FurnitureItem {
  id: string;
  name: string;
  category: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  placement: "sofa_wall" | "tv_wall" | "center" | "corner" | "dining_area";
}

export interface ValidationReport {
  overallStatus: "pass" | "warning" | "block";
  items: ValidationItem[];
  layoutMetrics: LayoutMetrics;
  suggestions: string[];
}

export interface ValidationItem {
  furnitureId: string;
  furnitureName: string;
  status: "pass" | "warning" | "block";
  checks: Check[];
}

export interface Check {
  rule: string;
  status: "pass" | "warning" | "block";
  message: string;
  detail: string;
  actualValue: number;
  threshold: number;
}

export interface LayoutMetrics {
  sofaWallOccupancy: number;
  tvWallOccupancy: number;
  sofaToTvDistance: number | null;
  passageWidth: number | null;
  sofaToCoffeeTableGap: number | null;
  coffeeTableToTvGap: number | null;
}

const CHECK_PRIORITY: Record<Check["status"], number> = {
  pass: 0,
  warning: 1,
  block: 2,
};

const RULES = {
  sofaWallOccupancy: "sofa_wall_occupancy",
  tvWallOccupancy: "tv_wall_occupancy",
  sofaToTvDistance: "sofa_to_tv_distance",
  sofaToCoffeeGap: "sofa_to_coffee_gap",
  coffeeToSofaRatio: "coffee_to_sofa_ratio",
  passageWidth: "passage_width",
  heightToCeilingRatio: "height_to_ceiling_ratio",
  rugSize: "rug_size",
} as const;

function safeRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function normalizeCategory(category: string) {
  return category.trim().toLowerCase();
}

function isCategory(item: FurnitureItem, categories: string[]) {
  const category = normalizeCategory(item.category);
  return categories.includes(category);
}

function findFurniture(furniture: FurnitureItem[], categories: string[]) {
  return furniture.find((item) => isCategory(item, categories));
}

function roundToInt(value: number) {
  return Math.round(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function deriveItemStatus(checks: Check[]): ValidationItem["status"] {
  return checks.reduce<ValidationItem["status"]>(
    (current, check) =>
      CHECK_PRIORITY[check.status] > CHECK_PRIORITY[current] ? check.status : current,
    "pass",
  );
}

function deriveOverallStatus(items: ValidationItem[]): ValidationReport["overallStatus"] {
  if (items.some((item) => item.status === "block")) {
    return "block";
  }

  if (items.some((item) => item.status === "warning")) {
    return "warning";
  }

  return "pass";
}

export function calculateLayoutMetrics(
  room: RoomDimensions,
  furniture: FurnitureItem[],
): LayoutMetrics {
  const sofa = findFurniture(furniture, ["sofa"]);
  const tvCabinet = findFurniture(furniture, ["tv_cabinet", "tv-cabinet", "tvcabinet"]);
  const coffeeTable = findFurniture(furniture, [
    "coffee_table",
    "coffee-table",
    "coffee",
  ]);

  const sofaWallOccupancy = sofa
    ? safeRatio(sofa.widthMm, room.sofaWallWidthMm)
    : 0;
  const tvWallOccupancy = tvCabinet
    ? safeRatio(tvCabinet.widthMm, room.tvWallWidthMm)
    : 0;

  const sofaToTvDistance =
    room.roomDepthMm !== null && sofa && tvCabinet
      ? room.roomDepthMm - sofa.depthMm - tvCabinet.depthMm
      : null;

  const passageWidth =
    room.roomDepthMm !== null && sofa && coffeeTable && tvCabinet
      ? room.roomDepthMm - sofa.depthMm - coffeeTable.depthMm - tvCabinet.depthMm
      : null;

  const sofaToCoffeeTableGap =
    sofaToTvDistance !== null && coffeeTable
      ? (sofaToTvDistance - coffeeTable.depthMm) / 2
      : null;

  const coffeeTableToTvGap = sofaToCoffeeTableGap;

  return {
    sofaWallOccupancy,
    tvWallOccupancy,
    sofaToTvDistance,
    passageWidth,
    sofaToCoffeeTableGap,
    coffeeTableToTvGap,
  };
}

export function getMaxRecommendedSize(room: RoomDimensions, category: string) {
  const normalized = normalizeCategory(category);
  const fallbackDepthBase = room.roomDepthMm ?? 4200;

  if (normalized === "sofa") {
    return {
      maxWidthMm: roundToInt(room.sofaWallWidthMm * 0.7),
      maxDepthMm: roundToInt(fallbackDepthBase * 0.28),
      reason: "沙发建议不超过沙发墙宽的 70%，避免压迫与动线拥堵。",
    };
  }

  if (["tv_cabinet", "tv-cabinet", "tvcabinet"].includes(normalized)) {
    return {
      maxWidthMm: roundToInt(room.tvWallWidthMm * 0.7),
      maxDepthMm: roundToInt(fallbackDepthBase * 0.16),
      reason: "电视柜建议不超过电视墙宽的 70%，保留两侧留白。",
    };
  }

  if (["coffee_table", "coffee-table", "coffee"].includes(normalized)) {
    return {
      maxWidthMm: roundToInt(room.sofaWallWidthMm * 0.67),
      maxDepthMm: roundToInt(fallbackDepthBase * 0.2),
      reason: "茶几建议控制在沙发比例范围内，便于起身与通行。",
    };
  }

  return {
    maxWidthMm: roundToInt(Math.min(room.sofaWallWidthMm, room.tvWallWidthMm) * 0.6),
    maxDepthMm: roundToInt(fallbackDepthBase * 0.22),
    reason: "建议优先保证主要通道宽度与视觉留白。",
  };
}

export function validateLayout(
  room: RoomDimensions,
  furniture: FurnitureItem[],
): ValidationReport {
  const checksByFurnitureId = new Map<string, Check[]>();
  const suggestions = new Set<string>();
  const layoutMetrics = calculateLayoutMetrics(room, furniture);

  const sofa = findFurniture(furniture, ["sofa"]);
  const tvCabinet = findFurniture(furniture, ["tv_cabinet", "tv-cabinet", "tvcabinet"]);
  const coffeeTable = findFurniture(furniture, [
    "coffee_table",
    "coffee-table",
    "coffee",
  ]);
  const rug = findFurniture(furniture, ["rug", "carpet"]);

  const addCheck = (item: FurnitureItem | undefined, check: Check) => {
    if (!item) {
      return;
    }

    const existing = checksByFurnitureId.get(item.id) ?? [];
    checksByFurnitureId.set(item.id, [...existing, check]);
  };

  if (sofa) {
    const ratio = layoutMetrics.sofaWallOccupancy;
    const recommended = getMaxRecommendedSize(room, "sofa").maxWidthMm;

    if (ratio <= 0.75) {
      addCheck(sofa, {
        rule: RULES.sofaWallOccupancy,
        status: "pass",
        message: "沙发占墙宽比例合理。",
        detail: `当前占比 ${formatPercent(ratio)}，在推荐阈值内。`,
        actualValue: ratio,
        threshold: 0.75,
      });
    } else if (ratio <= 0.85) {
      addCheck(sofa, {
        rule: RULES.sofaWallOccupancy,
        status: "warning",
        message: "沙发偏大，两侧空间较紧，建议预留至少300mm。",
        detail: `当前占比 ${formatPercent(ratio)}。`,
        actualValue: ratio,
        threshold: 0.85,
      });
    } else {
      addCheck(sofa, {
        rule: RULES.sofaWallOccupancy,
        status: "block",
        message: `沙发过大，无法合理摆放。建议换${recommended}mm以内的款。`,
        detail: `当前占比 ${formatPercent(ratio)}，已超出可用空间。`,
        actualValue: ratio,
        threshold: 0.85,
      });
      suggestions.add(`建议将沙发宽度控制在 ${recommended}mm 以内（墙宽×0.7）。`);
    }
  }

  if (tvCabinet) {
    const ratio = layoutMetrics.tvWallOccupancy;
    const recommended = getMaxRecommendedSize(room, "tv_cabinet").maxWidthMm;

    if (ratio <= 0.75) {
      addCheck(tvCabinet, {
        rule: RULES.tvWallOccupancy,
        status: "pass",
        message: "电视柜占墙宽比例合理。",
        detail: `当前占比 ${formatPercent(ratio)}，在推荐阈值内。`,
        actualValue: ratio,
        threshold: 0.75,
      });
    } else if (ratio <= 0.85) {
      addCheck(tvCabinet, {
        rule: RULES.tvWallOccupancy,
        status: "warning",
        message: "电视柜偏大，两侧空间较紧。",
        detail: `当前占比 ${formatPercent(ratio)}。`,
        actualValue: ratio,
        threshold: 0.85,
      });
    } else {
      addCheck(tvCabinet, {
        rule: RULES.tvWallOccupancy,
        status: "block",
        message: `电视柜过大，建议换${recommended}mm以内的款。`,
        detail: `当前占比 ${formatPercent(ratio)}，已超出可用空间。`,
        actualValue: ratio,
        threshold: 0.85,
      });
    }
  }

  if (layoutMetrics.sofaToTvDistance !== null && sofa) {
    const distance = layoutMetrics.sofaToTvDistance;

    if (distance >= 2500) {
      addCheck(sofa, {
        rule: RULES.sofaToTvDistance,
        status: "pass",
        message: "沙发到电视墙距离充足。",
        detail: `当前净距 ${roundToInt(distance)}mm。`,
        actualValue: distance,
        threshold: 2500,
      });
    } else if (distance >= 2000) {
      addCheck(sofa, {
        rule: RULES.sofaToTvDistance,
        status: "warning",
        message: "观影距离偏紧，建议优化家具深度。",
        detail: `当前净距 ${roundToInt(distance)}mm。`,
        actualValue: distance,
        threshold: 2000,
      });
    } else {
      addCheck(sofa, {
        rule: RULES.sofaToTvDistance,
        status: "block",
        message: "沙发到电视墙距离不足，无法形成舒适观影区。",
        detail: `当前净距 ${roundToInt(distance)}mm。`,
        actualValue: distance,
        threshold: 2000,
      });
    }
  }

  if (layoutMetrics.sofaToCoffeeTableGap !== null && coffeeTable) {
    const gap = layoutMetrics.sofaToCoffeeTableGap;

    if (gap >= 350) {
      addCheck(coffeeTable, {
        rule: RULES.sofaToCoffeeGap,
        status: "pass",
        message: "沙发到茶几间距可用。",
        detail: `当前净距 ${roundToInt(gap)}mm。`,
        actualValue: gap,
        threshold: 350,
      });
    } else if (gap >= 250) {
      addCheck(coffeeTable, {
        rule: RULES.sofaToCoffeeGap,
        status: "warning",
        message: "沙发到茶几间距偏窄，起身体验会受影响。",
        detail: `当前净距 ${roundToInt(gap)}mm。`,
        actualValue: gap,
        threshold: 250,
      });
    } else {
      addCheck(coffeeTable, {
        rule: RULES.sofaToCoffeeGap,
        status: "block",
        message: "沙发到茶几间距过小，存在使用阻塞。",
        detail: `当前净距 ${roundToInt(gap)}mm。`,
        actualValue: gap,
        threshold: 250,
      });
    }
  }

  if (sofa && coffeeTable) {
    const ratio = safeRatio(coffeeTable.widthMm, sofa.widthMm);
    const recommendedMin = roundToInt(sofa.widthMm * 0.5);
    const recommendedMax = roundToInt(sofa.widthMm * 0.67);

    if (ratio >= 0.5 && ratio <= 0.67) {
      addCheck(coffeeTable, {
        rule: RULES.coffeeToSofaRatio,
        status: "pass",
        message: "茶几与沙发比例协调。",
        detail: `当前比例 ${formatPercent(ratio)}。`,
        actualValue: ratio,
        threshold: 0.5,
      });
    } else {
      const isSevere = ratio < 0.4 || ratio > 0.75;
      addCheck(coffeeTable, {
        rule: RULES.coffeeToSofaRatio,
        status: "warning",
        message: isSevere ? "茶几比例明显失衡。" : "茶几比例偏离推荐区间。",
        detail: `当前比例 ${formatPercent(ratio)}，建议在 50%-67% 之间。`,
        actualValue: ratio,
        threshold: 0.5,
      });
      suggestions.add(
        `茶几建议宽度区间：${recommendedMin}mm - ${recommendedMax}mm（沙发宽×0.5~0.67）。`,
      );
    }
  }

  if (layoutMetrics.passageWidth !== null) {
    const passage = layoutMetrics.passageWidth;
    const checkTarget = coffeeTable ?? sofa ?? tvCabinet;

    if (passage >= 800) {
      addCheck(checkTarget, {
        rule: RULES.passageWidth,
        status: "pass",
        message: "通道宽度满足日常通行。",
        detail: `当前通道宽度 ${roundToInt(passage)}mm。`,
        actualValue: passage,
        threshold: 800,
      });
    } else if (passage >= 600) {
      addCheck(checkTarget, {
        rule: RULES.passageWidth,
        status: "warning",
        message: "通道偏窄，建议减少家具进深。",
        detail: `当前通道宽度 ${roundToInt(passage)}mm。`,
        actualValue: passage,
        threshold: 600,
      });
    } else {
      addCheck(checkTarget, {
        rule: RULES.passageWidth,
        status: "block",
        message: "通道过窄，无法保证基本通行。",
        detail: `当前通道宽度 ${roundToInt(passage)}mm。`,
        actualValue: passage,
        threshold: 600,
      });
    }
  }

  if (room.ceilingHeightMm !== null) {
    let allHeightChecksPass = furniture.length > 0;

    for (const item of furniture) {
      const ratio = safeRatio(item.heightMm, room.ceilingHeightMm);

      if (ratio <= 0.65) {
        addCheck(item, {
          rule: RULES.heightToCeilingRatio,
          status: "pass",
          message: "家具高度与层高匹配。",
          detail: `当前占层高比例 ${formatPercent(ratio)}。`,
          actualValue: ratio,
          threshold: 0.65,
        });
      } else if (ratio <= 0.75) {
        allHeightChecksPass = false;
        addCheck(item, {
          rule: RULES.heightToCeilingRatio,
          status: "warning",
          message: "家具偏高，视觉可能略压抑。",
          detail: `当前占层高比例 ${formatPercent(ratio)}。`,
          actualValue: ratio,
          threshold: 0.75,
        });
      } else {
        allHeightChecksPass = false;
        addCheck(item, {
          rule: RULES.heightToCeilingRatio,
          status: "block",
          message: "家具高度过高，不建议摆放。",
          detail: `当前占层高比例 ${formatPercent(ratio)}。`,
          actualValue: ratio,
          threshold: 0.75,
        });
      }
    }

    if (allHeightChecksPass) {
      suggestions.add("层高条件优秀，家具尺度留白充足，可放心维持当前高度配置。");
    }
  }

  if (sofa && rug) {
    const threshold = sofa.widthMm + 400;
    const actual = rug.widthMm;

    if (actual >= threshold) {
      addCheck(rug, {
        rule: RULES.rugSize,
        status: "pass",
        message: "地毯宽度覆盖范围合理。",
        detail: `当前地毯宽度 ${actual}mm，建议至少 ${threshold}mm。`,
        actualValue: actual,
        threshold,
      });
    } else {
      addCheck(rug, {
        rule: RULES.rugSize,
        status: "warning",
        message: "地毯偏小，建议扩大以承托沙发区域。",
        detail: `当前地毯宽度 ${actual}mm，建议至少 ${threshold}mm。`,
        actualValue: actual,
        threshold,
      });
    }
  }

  const items: ValidationItem[] = furniture.map((item) => {
    const checks = checksByFurnitureId.get(item.id) ?? [];
    return {
      furnitureId: item.id,
      furnitureName: item.name,
      status: deriveItemStatus(checks),
      checks,
    };
  });

  const overallStatus = deriveOverallStatus(items);

  return {
    overallStatus,
    items,
    layoutMetrics,
    suggestions: [...suggestions],
  };
}
