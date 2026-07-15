import { describe, expect, it } from "vitest";
import {
  mapRotatedBadgeBounds,
  rotatedTextBaselineSvg,
  rotateLocalPoint,
} from "@/lib/cut-plan/pdf-label-geometry";

describe("pdf-label-geometry", () => {
  it("rotateLocalPoint(-90) как SVG: (w,0) → (0,w)", () => {
    const p = rotateLocalPoint(10, 0, -90);
    expect(p.xMm).toBeCloseTo(0, 6);
    expect(p.yMm).toBeCloseTo(10, 6);
  });

  it("AABB повёрнутого бейджа при -90 — обмен сторон вокруг якоря", () => {
    const badge = { xMm: -20, yMm: -6, widthMm: 40, heightMm: 12 };
    const bounds = mapRotatedBadgeBounds({ xMm: 100, yMm: 200 }, badge, -90);
    expect(bounds.widthMm).toBeCloseTo(12, 6);
    expect(bounds.heightMm).toBeCloseTo(40, 6);
    expect(bounds.xMm + bounds.widthMm / 2).toBeCloseTo(100, 6);
    expect(bounds.yMm + bounds.heightMm / 2).toBeCloseTo(200, 6);
  });

  it("baseline повёрнутого текста смещён от якоря, не совпадает с ним", () => {
    const baseline = rotatedTextBaselineSvg(
      { xMm: 100, yMm: 200, rotateDeg: -90 },
      30,
      12,
    );
    expect(baseline.xMm).not.toBeCloseTo(100, 1);
    expect(baseline.yMm).not.toBeCloseTo(200, 1);
    // При -90: local (-15, 4.2) → (x'=-4.2, y'=-15) → якорь+(−4.2, −15)
    expect(baseline.xMm).toBeCloseTo(100 - 4.2, 5);
    expect(baseline.yMm).toBeCloseTo(200 - 15, 5);
  });
});
