import type { CuttingResult } from "@/lib/engine-bar/cutting";

export type BarWorkspaceSnapshot = {
  projectId: string;
  projectName: string;
  contractNumber: string | null;
  kerfMm: number;
  applyMiter: boolean;
  segments: {
    id: string;
    label: string;
    outerMm: number;
    innerMm: number | null;
    quantity: number;
    colorIndex: number;
    material: string | null;
  }[];
  stocks: {
    id: string;
    lengthMm: number;
    quantity: number | null;
    name: string | null;
  }[];
  result: CuttingResult | null;
};

type BarProjectForSerialize = {
  id: string;
  name: string;
  contractNumber: string | null;
  barKerfMm: { toString(): string } | number;
  barApplyMiter: boolean;
  barSegments: {
    id: string;
    label: string;
    outerMm: number;
    innerMm: number | null;
    quantity: number;
    colorIndex: number;
    material: string | null;
  }[];
  barStocks: {
    id: string;
    lengthMm: number;
    quantity: number | null;
    name: string | null;
  }[];
  barCutPlans: { resultJson: unknown }[];
};

export function serializeBarWorkspace(
  project: BarProjectForSerialize,
): BarWorkspaceSnapshot {
  const latest = project.barCutPlans[0]?.resultJson ?? null;
  return {
    projectId: project.id,
    projectName: project.name,
    contractNumber: project.contractNumber,
    kerfMm: Number(project.barKerfMm),
    applyMiter: project.barApplyMiter,
    segments: project.barSegments.map((s) => ({
      id: s.id,
      label: s.label,
      outerMm: s.outerMm,
      innerMm: s.innerMm,
      quantity: s.quantity,
      colorIndex: s.colorIndex,
      material: s.material,
    })),
    stocks: project.barStocks.map((s) => ({
      id: s.id,
      lengthMm: s.lengthMm,
      quantity: s.quantity,
      name: s.name,
    })),
    result: latest as CuttingResult | null,
  };
}
