"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { PlacedFurniture, RoomPlanDimensions, WallSegment } from "@/lib/layout/types";

export interface FloorPlanViewProps {
  room: RoomPlanDimensions;
  furniture: PlacedFurniture[];
  selectedFurnitureId: string | null;
  onFurnitureSelect: (id: string | null) => void;
  onFurnitureMove: (id: string, x: number, y: number) => void;
  readOnly?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  sofa: "#2B3A4A",
  coffee_table: "#8B5A37",
  tv_cabinet: "#6B8E6B",
  dining_table: "#C8956C",
  rug: "#DDDDDD",
  floor_lamp: "#FDCB6E",
  bed: "#9B59B6",
  side_table: "#E67E22",
};

const PADDING = 36;
const MAX_VIEW_HEIGHT = 560;

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function getFurnitureColor(item: PlacedFurniture) {
  return CATEGORY_COLORS[item.category] ?? item.color ?? "#94A3B8";
}

function getRotatedSize(item: PlacedFurniture) {
  if (item.rotation === 90 || item.rotation === 270) {
    return {
      widthMm: item.depthMm,
      depthMm: item.widthMm,
    };
  }

  return {
    widthMm: item.widthMm,
    depthMm: item.depthMm,
  };
}

function mmToLabel(value: number) {
  return `${Math.round(value)}mm`;
}

function buildWallLine(
  wall: WallSegment,
  room: RoomPlanDimensions,
  scale: number,
  x0: number,
  y0: number,
) {
  const safeStart = clamp(Math.min(wall.startMm, wall.endMm), 0, wall.side === "left" || wall.side === "right" ? room.depthMm : room.widthMm);
  const safeEnd = clamp(Math.max(wall.startMm, wall.endMm), 0, wall.side === "left" || wall.side === "right" ? room.depthMm : room.widthMm);

  if (wall.side === "top") {
    return {
      x1: x0 + safeStart * scale,
      y1: y0,
      x2: x0 + safeEnd * scale,
      y2: y0,
    };
  }

  if (wall.side === "bottom") {
    return {
      x1: x0 + safeStart * scale,
      y1: y0 + room.depthMm * scale,
      x2: x0 + safeEnd * scale,
      y2: y0 + room.depthMm * scale,
    };
  }

  if (wall.side === "left") {
    return {
      x1: x0,
      y1: y0 + safeStart * scale,
      x2: x0,
      y2: y0 + safeEnd * scale,
    };
  }

  return {
    x1: x0 + room.widthMm * scale,
    y1: y0 + safeStart * scale,
    x2: x0 + room.widthMm * scale,
    y2: y0 + safeEnd * scale,
  };
}

function wallStrokeStyle(type: WallSegment["type"]) {
  if (type === "window") {
    return { stroke: "#3B82F6", strokeWidth: 3, dashArray: "8 6" };
  }

  if (type === "door") {
    return { stroke: "#8B5A37", strokeWidth: 3, dashArray: undefined };
  }

  if (type === "opening") {
    return { stroke: "transparent", strokeWidth: 0, dashArray: undefined };
  }

  return { stroke: "#2F2A24", strokeWidth: 4, dashArray: undefined };
}

export function FloorPlanView({
  room,
  furniture,
  selectedFurnitureId,
  onFurnitureSelect,
  onFurnitureMove,
  readOnly = false,
}: FloorPlanViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const updateSize = () => {
      const width = containerRef.current?.clientWidth ?? 0;
      setContainerWidth(width);
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const drawableWidth = Math.max(120, containerWidth - PADDING * 2);
  const drawableHeight = MAX_VIEW_HEIGHT - PADDING * 2;
  const widthScale = drawableWidth / room.widthMm;
  const depthScale = drawableHeight / room.depthMm;
  const scale = Math.max(0.05, Math.min(widthScale, depthScale));
  const roomWidthPx = room.widthMm * scale;
  const roomDepthPx = room.depthMm * scale;
  const svgWidth = roomWidthPx + PADDING * 2;
  const svgHeight = roomDepthPx + PADDING * 2;
  const roomStartX = PADDING;
  const roomStartY = PADDING;

  const selectedFurniture = furniture.find((item) => item.id === selectedFurnitureId) ?? null;
  const draggingFurniture = furniture.find((item) => item.id === draggingId) ?? null;
  const activeFurniture = draggingFurniture ?? selectedFurniture;
  const wallDistanceText = activeFurniture
    ? (() => {
        const size = getRotatedSize(activeFurniture);
        const left = activeFurniture.x;
        const right = room.widthMm - activeFurniture.x - size.widthMm;
        const top = activeFurniture.y;
        const bottom = room.depthMm - activeFurniture.y - size.depthMm;

        return `左 ${mmToLabel(left)} | 右 ${mmToLabel(right)} | 上 ${mmToLabel(top)} | 下 ${mmToLabel(bottom)}`;
      })()
    : null;

  const getLocalPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) {
      return null;
    }

    const point = svgRef.current.createSVGPoint();
    point.x = clientX;
    point.y = clientY;

    const matrix = svgRef.current.getScreenCTM();
    if (!matrix) {
      return null;
    }

    return point.matrixTransform(matrix.inverse());
  };

  const handlePointerDown = (
    event: ReactPointerEvent<SVGRectElement | SVGCircleElement>,
    item: PlacedFurniture,
  ) => {
    onFurnitureSelect(item.id);
    if (readOnly) {
      return;
    }

    const local = getLocalPoint(event.clientX, event.clientY);
    if (!local) {
      return;
    }

    const pointerMmX = (local.x - roomStartX) / scale;
    const pointerMmY = (local.y - roomStartY) / scale;

    setDraggingId(item.id);
    setPointerOffset({
      x: pointerMmX - item.x,
      y: pointerMmY - item.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingId || !pointerOffset || readOnly) {
      return;
    }

    const local = getLocalPoint(event.clientX, event.clientY);
    if (!local) {
      return;
    }

    const target = furniture.find((item) => item.id === draggingId);
    if (!target) {
      return;
    }

    const size = getRotatedSize(target);
    const pointerMmX = (local.x - roomStartX) / scale;
    const pointerMmY = (local.y - roomStartY) / scale;
    const nextX = clamp(pointerMmX - pointerOffset.x, 0, Math.max(0, room.widthMm - size.widthMm));
    const nextY = clamp(pointerMmY - pointerOffset.y, 0, Math.max(0, room.depthMm - size.depthMm));

    onFurnitureMove(target.id, Math.round(nextX), Math.round(nextY));
  };

  const handlePointerEnd = () => {
    setDraggingId(null);
    setPointerOffset(null);
  };

  return (
    <div className="w-full space-y-3">
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-2xl border border-border bg-[#faf7f2]"
      >
        {containerWidth > 0 ? (
          <svg
            ref={svgRef}
            width="100%"
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
            className={cn("touch-none select-none", readOnly ? "cursor-default" : "cursor-grab")}
          >
            <text
              x={roomStartX + roomWidthPx / 2}
              y={16}
              textAnchor="middle"
              className="fill-muted-foreground text-[12px]"
            >
              {`宽度 ${mmToLabel(room.widthMm)}`}
            </text>
            <text
              x={16}
              y={roomStartY + roomDepthPx / 2}
              transform={`rotate(-90 16 ${roomStartY + roomDepthPx / 2})`}
              textAnchor="middle"
              className="fill-muted-foreground text-[12px]"
            >
              {`进深 ${mmToLabel(room.depthMm)}`}
            </text>

            <rect
              x={roomStartX}
              y={roomStartY}
              width={roomWidthPx}
              height={roomDepthPx}
              fill="#ffffff"
              stroke="#4b5563"
              strokeWidth={2}
              rx={8}
            />

            {room.walls.map((wall, index) => {
              const points = buildWallLine(wall, room, scale, roomStartX, roomStartY);
              const style = wallStrokeStyle(wall.type);

              if (wall.type === "door") {
                const doorPath =
                  wall.side === "top" || wall.side === "bottom"
                    ? `M ${points.x1} ${points.y1} Q ${(points.x1 + points.x2) / 2} ${points.y1 + (wall.side === "top" ? 24 : -24)} ${points.x2} ${points.y2}`
                    : `M ${points.x1} ${points.y1} Q ${points.x1 + (wall.side === "left" ? 24 : -24)} ${(points.y1 + points.y2) / 2} ${points.x2} ${points.y2}`;

                return (
                  <g key={`${wall.side}-${index}`}>
                    <line
                      x1={points.x1}
                      y1={points.y1}
                      x2={points.x2}
                      y2={points.y2}
                      stroke="#8B5A37"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <path d={doorPath} fill="none" stroke="#8B5A37" strokeWidth={2} />
                  </g>
                );
              }

              return (
                <line
                  key={`${wall.side}-${index}`}
                  x1={points.x1}
                  y1={points.y1}
                  x2={points.x2}
                  y2={points.y2}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.dashArray}
                  strokeLinecap="round"
                />
              );
            })}

            {furniture.map((item) => {
              const size = getRotatedSize(item);
              const x = roomStartX + item.x * scale;
              const y = roomStartY + item.y * scale;
              const width = size.widthMm * scale;
              const height = size.depthMm * scale;
              const isSelected = selectedFurnitureId === item.id;
              const color = getFurnitureColor(item);
              const showLabel = width > 80 && height > 38;

              if (item.category === "floor_lamp") {
                const radius = Math.max(8, Math.min(width, height) / 2);
                const cx = x + width / 2;
                const cy = y + height / 2;

                return (
                  <g key={item.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={color}
                      fillOpacity={0.6}
                      stroke={isSelected ? "#8B5A37" : color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      onPointerDown={(event) => handlePointerDown(event, item)}
                      className={readOnly ? "cursor-default" : "cursor-move"}
                    />
                    {showLabel ? (
                      <text
                        x={cx}
                        y={cy + 3}
                        textAnchor="middle"
                        className="fill-foreground text-[10px]"
                      >
                        {item.name}
                      </text>
                    ) : null}
                  </g>
                );
              }

              return (
                <g key={item.id}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={4}
                    fill={item.category === "rug" ? "transparent" : color}
                    fillOpacity={item.category === "rug" ? 1 : 0.55}
                    stroke={isSelected ? "#8B5A37" : color}
                    strokeWidth={isSelected ? 2.5 : 1.4}
                    strokeDasharray={item.category === "rug" ? "8 5" : undefined}
                    onPointerDown={(event) => handlePointerDown(event, item)}
                    className={readOnly ? "cursor-default" : "cursor-move"}
                  />

                  {isSelected
                    ? [
                        [x, y],
                        [x + width, y],
                        [x, y + height],
                        [x + width, y + height],
                      ].map(([cx, cy], idx) => (
                        <rect
                          key={`${item.id}-handle-${idx}`}
                          x={cx - 3}
                          y={cy - 3}
                          width={6}
                          height={6}
                          fill="#8B5A37"
                          rx={1}
                        />
                      ))
                    : null}

                  {showLabel ? (
                    <>
                      <text
                        x={x + width / 2}
                        y={y + height / 2 - 4}
                        textAnchor="middle"
                        className="pointer-events-none fill-foreground text-[10px]"
                      >
                        {item.name}
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + height / 2 + 10}
                        textAnchor="middle"
                        className="pointer-events-none fill-muted-foreground text-[9px]"
                      >
                        {`${item.widthMm}×${item.depthMm}`}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
        {wallDistanceText ?? "点击家具可查看到墙距离，拖拽可调整布局位置。"}
      </div>
    </div>
  );
}
