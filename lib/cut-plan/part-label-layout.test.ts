import { describe, expect, it } from "vitest";
import {
  buildPartLabelLayout,
  formatOffcutMarking,
  LABEL_CENTER_SIZE_FONT_MM,
  LABEL_MARKING_FONT_MM,
  LABEL_SIDE_FONT_MM,
  sortOffcutsForLabeling,
} from "@/lib/cut-plan/part-label-layout";

describe("part-label-layout", () => {
  it("даёт центральному бейджу сбалансированные внутренние отступы", () => {
    const rect = { xMm: 0, yMm: 0, widthMm: 1330, heightMm: 900 };
    const layout = buildPartLabelLayout(rect, "П(Ц)-1 [05] - 1", 900, 1330);
    const badge = layout.centerBadge;

    const topGap = layout.marking.yMm - LABEL_MARKING_FONT_MM / 2 - badge.yMm;
    const bottomGap =
      badge.yMm + badge.heightMm - (layout.centerSize!.yMm + LABEL_CENTER_SIZE_FONT_MM / 2);
    const lineGap =
      layout.centerSize!.yMm -
      LABEL_CENTER_SIZE_FONT_MM / 2 -
      (layout.marking.yMm + LABEL_MARKING_FONT_MM / 2);

    expect(topGap).toBeCloseTo(18, 0);
    expect(bottomGap).toBeCloseTo(18, 0);
    expect(lineGap).toBeCloseTo(14, 0);
  });

  it("вписывает боковой бейдж внутрь контура", () => {
    const rect = { xMm: 100, yMm: 50, widthMm: 1330, heightMm: 900 };
    const layout = buildPartLabelLayout(rect, "П(Ц)-1 [05] - 1", 900, 1330);

    expect(layout.rightSide).not.toBeNull();
    expect(layout.rightBadge).not.toBeNull();

    const inset = 16 + 1.5;
    const anchorX = layout.rightSide!.xMm;
    const halfExtent = layout.rightBadge!.heightMm / 2;

    expect(anchorX + halfExtent).toBeLessThanOrEqual(rect.xMm + rect.widthMm - inset + 0.01);
    expect(anchorX - halfExtent).toBeGreaterThanOrEqual(rect.xMm + inset - 0.01);
  });

  it("использует одинаковые размеры шрифта для детали и обрезка", () => {
    const part = buildPartLabelLayout(
      { xMm: 0, yMm: 0, widthMm: 1330, heightMm: 900 },
      "П(Ц)-1 [06] - 1",
      900,
      1970,
    );
    const offcut = buildPartLabelLayout(
      { xMm: 0, yMm: 0, widthMm: 350, heightMm: 530 },
      "1",
      350,
      530,
    );

    expect(part.marking.fontSizeMm).toBe(offcut.marking.fontSizeMm);
    expect(part.centerSize?.fontSizeMm).toBe(offcut.centerSize?.fontSizeMm);
    expect(part.bottomSide?.fontSizeMm).toBe(offcut.bottomSide?.fontSizeMm);
  });

  it("на маленькой области скрывает подписи у сторон, но не меняет размер шрифта", () => {
    const layout = buildPartLabelLayout(
      { xMm: 0, yMm: 0, widthMm: 140, heightMm: 160 },
      "П(Ц)-9 [01] - 1",
      140,
      160,
    );

    expect(layout.mode).toBe("compact");
    expect(layout.marking.fontSizeMm).toBe(LABEL_MARKING_FONT_MM);
    expect(layout.centerSize?.fontSizeMm).toBe(LABEL_CENTER_SIZE_FONT_MM);
    expect(layout.bottomSide).toBeNull();
    expect(layout.rightSide).toBeNull();
  });

  it("нумерует обрезки снизу вверх и слева направо", () => {
    const sorted = sortOffcutsForLabeling([
      { id: "b", xMm: 900, yMm: 0, widthMm: 350, heightMm: 2500 },
      { id: "a", xMm: 0, yMm: 1330, widthMm: 900, heightMm: 1170 },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["b", "a"]);
    expect(formatOffcutMarking(1)).toBe("1");
  });
});
