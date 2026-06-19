export type PrimaryAxis = "vertical" | "horizontal" | "auto";

export interface EngineMachine {
  kerfMm: number;
  minSafePartWidthMm: number;
  minSafePartHeightMm: number;
  supportsStopCut: boolean;
  supportsInternalCut: boolean;
  requiresCornerDrillingForInternalCut: boolean;
  preferredPrimaryAxis: PrimaryAxis;
  minUsefulOffcutWidthMm: number;
  minUsefulOffcutHeightMm: number;
}

export interface EngineSheet {
  widthMm: number;
  heightMm: number;
  trimLeftMm: number;
  trimRightMm: number;
  trimTopMm: number;
  trimBottomMm: number;
}

export interface EnginePart {
  id: string;
  name: string;
  code?: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  shapeType: "rectangle";
  allowRotation: boolean;
  grainDirectionRequired: boolean;
  priority: number;
}

export interface EngineSettings {
  useOffcutsFirst: boolean;
  allowRotationDefault: boolean;
  minUsefulOffcutWidthMm: number;
  minUsefulOffcutHeightMm: number;
}

export interface EngineInput {
  projectId: string;
  mode: "production" | "economy" | "gkl_installation";
  machine: EngineMachine;
  sheet: EngineSheet;
  parts: EnginePart[];
  offcuts: [];
  settings: EngineSettings;
}

export interface EnginePlacement {
  partId: string;
  partInstanceIndex: number;
  partName: string;
  partCode?: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: 0 | 90;
  label: string;
}

export interface EngineOperation {
  sequenceNumber: number;
  operationType:
    | "trim_cut"
    | "full_cut"
    | "stop_cut"
    | "internal_cut"
    | "corner_drill"
    | "manual_finish"
    | "label_part"
    | "save_offcut";
  axis: "vertical" | "horizontal" | "none";
  x1Mm?: number;
  y1Mm?: number;
  x2Mm?: number;
  y2Mm?: number;
  positionMm?: number;
  targetPartId?: string;
  note?: string;
  riskLevel: "normal" | "attention" | "risky";
}

export interface EngineOffcut {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  areaMm2: number;
  isUseful: boolean;
}

export interface EngineSheetResult {
  sheetIndex: number;
  widthMm: number;
  heightMm: number;
  usableXmm: number;
  usableYmm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  placements: EnginePlacement[];
  operations: EngineOperation[];
  offcuts: EngineOffcut[];
  warnings: string[];
}

export interface EngineMetrics {
  sheetsCount: number;
  partsAreaMm2: number;
  wasteAreaMm2: number;
  wastePercent: number;
  operationsCount: number;
  manualOperationsCount: number;
  setupChangesCount: number;
}

export interface EngineResult {
  status: "success" | "failed";
  algorithmVersion: string;
  score: number;
  metrics: EngineMetrics;
  sheets: EngineSheetResult[];
  warnings: string[];
  errors?: string[];
}

export interface UsableArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PartInstance {
  partId: string;
  partName: string;
  partCode?: string;
  specOrder: number;
  instanceIndex: number;
  instanceCount: number;
  widthMm: number;
  heightMm: number;
  allowRotation: boolean;
  priority: number;
}

export interface PlacedPart extends PartInstance {
  xMm: number;
  yMm: number;
  rotationDeg: 0 | 90;
  label: string;
}

export interface Strip {
  xMm: number;
  widthMm: number;
  heightUsedMm: number;
  parts: PlacedPart[];
}

export interface PackedSheet {
  sheetIndex: number;
  strips: Strip[];
  placements: PlacedPart[];
}
