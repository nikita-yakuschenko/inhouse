import { describe, expect, it } from "vitest";

import {
  filterLeadersByGap,
  nextPieceStartLeaders,
  staggerLeaders,
} from "@/lib/bar/dimension-leaders";
import type { BarLayout } from "@/lib/engine-bar/cutting";

function bar(pieceLengths: number[], stockLengthMm = 6000): BarLayout {
  const usedMm = pieceLengths.reduce((s, l, i) => s + l + (i > 0 ? 3.5 : 0), 0);
  return {
    pieces: pieceLengths.map((lengthMm, i) => ({
      demandId: `p${i}`,
      label: `T${i}`,
      lengthMm,
      colorIndex: 0,
    })),
    usedMm,
    wasteMm: Math.max(0, stockLengthMm - usedMm),
    stockLengthMm,
  };
}

describe("nextPieceStartLeaders", () => {
  it("накопительная координата начала следующей детали (длина + пропил)", () => {
    const leaders = nextPieceStartLeaders(bar([355, 355, 355]), 3.5);
    expect(leaders.map((l) => l.valueMm)).toEqual([358.5, 717]);
    expect(leaders.map((l) => Math.round(l.valueMm))).toEqual([359, 717]);
  });

  it("одна деталь — без меток", () => {
    expect(nextPieceStartLeaders(bar([6000]), 3.5)).toEqual([]);
  });

  it("пропил 0 — метка сразу после конца детали", () => {
    const leaders = nextPieceStartLeaders(bar([100, 200]), 0);
    expect(leaders.map((l) => l.valueMm)).toEqual([100]);
  });
});

describe("filterLeadersByGap / staggerLeaders", () => {
  it("фильтрует близкие метки", () => {
    const items = nextPieceStartLeaders(bar([100, 100, 100, 100]), 3.5);
    const filtered = filterLeadersByGap(items, 6000, 0.045);
    expect(filtered.length).toBeLessThanOrEqual(items.length);
  });

  it("stagger не теряет точки", () => {
    const items = nextPieceStartLeaders(bar([355, 355, 355]), 3.5);
    expect(staggerLeaders(items, 6000)).toHaveLength(items.length);
  });
});
