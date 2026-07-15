import { describe, expect, it } from "vitest";
import {
  buildOffcutLabelLayout,
  buildPartLabelLayout,
  formatOffcutMarking,
  LABEL_SIDE_FONT_MM,
  sortOffcutsForLabeling,
} from "@/lib/cut-plan/part-label-layout";

describe("part-label-layout", () => {
  it("в compact держит бейдж и текст по центру детали", () => {
    const rect = { xMm: 0, yMm: 0, widthMm: 200, heightMm: 200 };
    const layout = buildPartLabelLayout(rect, "1 - 61", 200, 200);

    expect(layout.mode).toBe("compact");
    expect(layout.centerSize).not.toBeNull();

    const badgeCenterX = layout.centerBadge.xMm + layout.centerBadge.widthMm / 2;
    const badgeCenterY = layout.centerBadge.yMm + layout.centerBadge.heightMm / 2;
    expect(badgeCenterX).toBeCloseTo(100, 0);
    expect(badgeCenterY).toBeCloseTo(100, 0);
    expect(layout.marking.xMm).toBeCloseTo(100, 0);
    expect(layout.centerSize!.xMm).toBeCloseTo(100, 0);
  });

  it("на крупной детали: маркировка в центре, размеры по сторонам без дубля", () => {
    const rect = { xMm: 100, yMm: 50, widthMm: 1330, heightMm: 900 };
    const layout = buildPartLabelLayout(rect, "П(Ц)-1 [05] - 1", 900, 1330);

    expect(layout.mode).toBe("full");
    expect(layout.centerSize).toBeNull();
    expect(layout.bottomSide).not.toBeNull();
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
    expect(part.bottomSide?.fontSizeMm ?? LABEL_SIDE_FONT_MM).toBe(
      offcut.bottomSide?.fontSizeMm ?? LABEL_SIDE_FONT_MM,
    );
  });

  it("на маленькой области скрывает подписи у сторон и остаётся по центру", () => {
    const rect = { xMm: 0, yMm: 0, widthMm: 140, heightMm: 160 };
    const layout = buildPartLabelLayout(rect, "П(Ц)-9 [01] - 1", 140, 160);

    expect(layout.mode).toBe("compact");
    expect(layout.bottomSide).toBeNull();
    expect(layout.rightSide).toBeNull();
    expect(layout.centerBadge.xMm + layout.centerBadge.widthMm / 2).toBeCloseTo(70, 0);
    expect(layout.centerBadge.yMm + layout.centerBadge.heightMm / 2).toBeCloseTo(80, 0);
  });

  it("на 200×200 не накладывает боковые размеры на маркировку", () => {
    const layout = buildPartLabelLayout(
      { xMm: 0, yMm: 0, widthMm: 200, heightMm: 200 },
      "1 - 6",
      200,
      200,
    );

    expect(layout.mode).toBe("compact");
    expect(layout.centerSize?.text).toBe("200×200");
    expect(layout.bottomSide).toBeNull();
    expect(layout.rightSide).toBeNull();
    expect(layout.centerBadge.xMm + layout.centerBadge.widthMm / 2).toBeCloseTo(100, 0);
    expect(layout.centerBadge.yMm + layout.centerBadge.heightMm / 2).toBeCloseTo(100, 0);
  });

  it("для узкой полосы отхода делает выноску", () => {
    const sheet = { widthMm: 2500, heightMm: 1250 };
    const canvas = { xMm: -100, yMm: -100, widthMm: 2700, heightMm: 1450 };
    const rect = { xMm: 5, yMm: 5, widthMm: 2490, heightMm: 50 };
    const layout = buildOffcutLabelLayout(rect, "1", 50, 2490, sheet, canvas);

    expect(layout.type).toBe("callout");
    if (layout.type !== "callout") return;

    expect(layout.direction).toBe("top");
    expect(layout.badge.yMm + layout.badge.heightMm).toBeLessThanOrEqual(0);
    expect(layout.marking.text).toBe("1");
    expect(layout.size.text).toBe("50×2490");
  });

  it("для вертикального узкого отхода выносит подпись вправо за лист", () => {
    const sheet = { widthMm: 2500, heightMm: 1250 };
    const canvas = { xMm: -100, yMm: -100, widthMm: 2700, heightMm: 1450 };
    const rect = { xMm: 2470, yMm: 400, widthMm: 20, heightMm: 200 };
    const layout = buildOffcutLabelLayout(rect, "7", 200, 20, sheet, canvas);

    expect(layout.type).toBe("callout");
    if (layout.type !== "callout") return;

    expect(layout.direction).toBe("right");
    expect(layout.badge.xMm).toBeGreaterThanOrEqual(sheet.widthMm);
    expect(layout.marking.text).toBe("7");
    expect(layout.size.text).toBe("200×20");
  });

  it("для широкого отхода оставляет подпись внутри", () => {
    const sheet = { widthMm: 2500, heightMm: 1250 };
    const canvas = { xMm: -100, yMm: -100, widthMm: 2700, heightMm: 1450 };
    const rect = { xMm: 100, yMm: 100, widthMm: 400, heightMm: 500 };
    const layout = buildOffcutLabelLayout(rect, "2", 400, 500, sheet, canvas);

    expect(layout.type).toBe("inline");
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
