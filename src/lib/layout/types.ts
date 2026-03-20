export type WallType = "wall" | "window" | "door" | "opening";
export type WallSide = "top" | "bottom" | "left" | "right";

export interface WallSegment {
  side: WallSide;
  startMm: number;
  endMm: number;
  type: WallType;
}

export interface RoomPlanDimensions {
  widthMm: number;
  depthMm: number;
  ceilingHeightMm?: number;
  walls: WallSegment[];
}

export interface PlacedFurniture {
  id: string;
  name: string;
  category: string;
  widthMm: number;
  depthMm: number;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  color: string;
}

