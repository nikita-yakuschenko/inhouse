import prisma from "@/lib/db/prisma";
import {
  computeMiterDeltaMm,
  effectiveStockLengthMm,
  pieceDemandLengthMm,
  type PieceInput,
} from "@/lib/bar/build-demands";
import {
  STOCK_UNLIMITED,
  solveCuttingFromStocks,
  validateDemands,
  type CuttingResult,
  type DemandItem,
  type StockSpec,
} from "@/lib/engine-bar/cutting";
import { generateEntityId } from "@/lib/id";

export const BAR_ALGORITHM_VERSION = "bar-0.1.0";

export type BarSegmentRow = {
  id: string;
  label: string;
  outerMm: number;
  innerMm: number | null;
  quantity: number;
  colorIndex: number;
  material: string | null;
};

export type BarStockRow = {
  id: string;
  lengthMm: number;
  quantity: number | null;
  name: string | null;
};

function toPieceInputs(segments: BarSegmentRow[]): PieceInput[] {
  return segments.map((s) => ({
    id: s.id,
    label: s.label,
    outerMm: s.outerMm,
    innerMm: s.innerMm ?? 0,
    quantity: s.quantity,
  }));
}

export function buildBarDemands(segments: BarSegmentRow[]): {
  demands: DemandItem[];
  error: string | null;
} {
  const demands: DemandItem[] = [];
  let colorIndex = 0;
  for (const s of segments) {
    if (s.outerMm <= 0) {
      return { demands: [], error: "Укажите положительную длину детали (мм)." };
    }
    if (!Number.isInteger(s.quantity) || s.quantity < 1) {
      return {
        demands: [],
        error: `Количество для «${s.label || "деталь"}» должно быть целым числом ≥ 1.`,
      };
    }
    const piece: PieceInput = {
      id: s.id,
      label: s.label,
      outerMm: s.outerMm,
      innerMm: s.innerMm ?? 0,
      quantity: s.quantity,
    };
    demands.push({
      id: s.id,
      label: s.label.trim() || "Деталь",
      lengthMm: pieceDemandLengthMm(piece),
      quantity: s.quantity,
      colorIndex: (s.colorIndex >= 0 ? s.colorIndex : colorIndex) % 8,
    });
    colorIndex++;
  }
  return { demands, error: null };
}

export function buildBarStockSpecs(
  stocks: BarStockRow[],
  applyMiter: boolean,
  pieces: PieceInput[],
): { specs: StockSpec[]; error: string | null } {
  if (stocks.length === 0) {
    return { specs: [], error: "Добавьте хотя бы одну строку заготовки." };
  }
  const maxDelta = computeMiterDeltaMm(pieces);
  const specs: StockSpec[] = [];
  for (let i = 0; i < stocks.length; i++) {
    const row = stocks[i]!;
    if (row.lengthMm <= 0) {
      return {
        specs: [],
        error: `Заготовка (строка ${i + 1}): укажите длину в мм.`,
      };
    }
    const effMm = effectiveStockLengthMm(row.lengthMm, applyMiter, maxDelta);
    if (effMm <= 0) {
      return {
        specs: [],
        error:
          "После коррекции по фаскам длина заготовки получается ≤ 0 — проверьте длины.",
      };
    }
    const qty =
      row.quantity == null ? STOCK_UNLIMITED : Math.floor(row.quantity);
    if (qty !== STOCK_UNLIMITED && (qty < 1 || !Number.isInteger(qty))) {
      return {
        specs: [],
        error: `Количество заготовок (строка ${i + 1}): целое число ≥ 1 или без лимита.`,
      };
    }
    specs.push({ id: row.id, lengthMm: effMm, quantity: qty });
  }
  return { specs, error: null };
}

export async function calculateBarProject(projectId: string): Promise<
  | { ok: true; result: CuttingResult; cutPlanId: string }
  | { ok: false; error: string }
> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      barSegments: { orderBy: { sortOrder: "asc" } },
      barStocks: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!project) {
    return { ok: false, error: "Проект не найден" };
  }
  if (project.kind !== "bar") {
    return { ok: false, error: "Это не проект погонажа" };
  }

  const segments: BarSegmentRow[] = project.barSegments.map((s) => ({
    id: s.id,
    label: s.label,
    outerMm: s.outerMm,
    innerMm: s.innerMm,
    quantity: s.quantity,
    colorIndex: s.colorIndex,
    material: s.material,
  }));
  const stocks: BarStockRow[] = project.barStocks.map((s) => ({
    id: s.id,
    lengthMm: s.lengthMm,
    quantity: s.quantity,
    name: s.name,
  }));

  const { demands, error: demandErr } = buildBarDemands(segments);
  if (demandErr) return { ok: false, error: demandErr };

  const pieces = toPieceInputs(segments);
  const { specs, error: stockErr } = buildBarStockSpecs(
    stocks,
    project.barApplyMiter,
    pieces,
  );
  if (stockErr) return { ok: false, error: stockErr };

  const maxL = Math.max(...specs.map((s) => s.lengthMm));
  const validation = validateDemands(maxL, demands);
  if (validation) return { ok: false, error: validation };

  const kerfMm = Number(project.barKerfMm);
  let result: CuttingResult;
  try {
    result = solveCuttingFromStocks(specs, kerfMm, demands);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось выполнить раскрой",
    };
  }

  const cutPlanId = generateEntityId();
  await prisma.$transaction(async (tx) => {
    await tx.barCutPlan.deleteMany({ where: { projectId } });
    await tx.barCutPlan.create({
      data: {
        id: cutPlanId,
        projectId,
        algorithmVersion: BAR_ALGORITHM_VERSION,
        method: result.method,
        kerfMm: result.kerfMm,
        totalBarsCount: result.bars.length,
        totalStockMm: BigInt(Math.round(result.totalStockMm)),
        totalUsefulMm: BigInt(Math.round(result.totalUsefulMm)),
        wastePercent: result.wastePercent,
        totalCuts: result.totalCuts,
        multiStock: result.multiStock,
        resultJson: result as unknown as object,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { status: "calculated" },
    });
  });

  return { ok: true, result, cutPlanId };
}
