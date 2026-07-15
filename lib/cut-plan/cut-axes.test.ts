import { describe, expect, it } from "vitest";
import {
  buildCutAxesFromSegments,
  buildCutAxisLines,
} from "@/lib/cut-plan/cut-axes";

describe("cut axes", () => {
  it("собирает уникальные оси из отрезков реза", () => {
    const axes = buildCutAxesFromSegments([
      { axis: "vertical", x1Mm: 2681.75, y1Mm: 0, x2Mm: 2681.75, y2Mm: 640 },
      { axis: "horizontal", x1Mm: 0, y1Mm: 641.75, x2Mm: 3000, y2Mm: 641.75 },
      { axis: "horizontal", x1Mm: 0, y1Mm: 641.75, x2Mm: 345, y2Mm: 641.75 },
      { axis: "vertical", x1Mm: 346.75, y1Mm: 643.5, x2Mm: 346.75, y2Mm: 1133.5 },
    ]);

    expect(axes).toEqual([
      { axis: "vertical", positionMm: 346.75 },
      { axis: "vertical", positionMm: 2681.75 },
      { axis: "horizontal", positionMm: 641.75 },
    ]);
  });

  it("ось тянется на всю заготовку, отрезок реза короче", () => {
    const lines = buildCutAxisLines(
      [{ axis: "vertical", x1Mm: 100, y1Mm: 0, x2Mm: 100, y2Mm: 640 }],
      { xMm: 0, yMm: 0, widthMm: 3000, heightMm: 1250 },
    );

    expect(lines).toEqual([
      { x1Mm: 100, y1Mm: 0, x2Mm: 100, y2Mm: 1250 },
    ]);
  });
});
