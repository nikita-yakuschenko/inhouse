import { describe, expect, it } from "vitest";

import {
  buildOffcutHatchLines,
  clipOffcutHatchLines,
  clipSegmentToRect,
} from "@/lib/cut-plan/offcut-hatch";

describe("clipSegmentToRect", () => {
  const rect = { xMm: 100, yMm: 50, widthMm: 200, heightMm: 80 };

  it("keeps a segment fully inside the rect", () => {
    expect(clipSegmentToRect(120, 60, 180, 110, rect)).toEqual({
      x1Mm: 120,
      y1Mm: 60,
      x2Mm: 180,
      y2Mm: 110,
    });
  });

  it("trims a diagonal segment to the rect bounds", () => {
    const clipped = clipSegmentToRect(80, 40, 320, 150, rect);
    expect(clipped).not.toBeNull();
    expect(clipped!.x1Mm).toBeGreaterThanOrEqual(rect.xMm);
    expect(clipped!.y1Mm).toBeGreaterThanOrEqual(rect.yMm);
    expect(clipped!.x2Mm).toBeLessThanOrEqual(rect.xMm + rect.widthMm);
    expect(clipped!.y2Mm).toBeLessThanOrEqual(rect.yMm + rect.heightMm);
  });

  it("drops a segment completely outside the rect", () => {
    expect(clipSegmentToRect(0, 0, 20, 20, rect)).toBeNull();
  });
});

describe("clipOffcutHatchLines", () => {
  it("trims hatch segments to the full offcut rectangle", () => {
    const rect = { xMm: 520, yMm: 10, widthMm: 400, heightMm: 300 };
    const clipped = clipOffcutHatchLines(rect);

    expect(clipped.length).toBeGreaterThan(0);
    for (const line of clipped) {
      expect(line.x1Mm).toBeGreaterThanOrEqual(rect.xMm - 0.001);
      expect(line.y1Mm).toBeGreaterThanOrEqual(rect.yMm - 0.001);
      expect(line.x2Mm).toBeLessThanOrEqual(rect.xMm + rect.widthMm + 0.001);
      expect(line.y2Mm).toBeLessThanOrEqual(rect.yMm + rect.heightMm + 0.001);
    }

    const spansWidth = clipped.some(
      (line) =>
        Math.abs(line.x1Mm - line.x2Mm) > rect.widthMm * 0.4 ||
        Math.abs(line.y1Mm - line.y2Mm) > rect.heightMm * 0.4,
    );
    expect(spansWidth).toBe(true);
  });

  it("builds more raw hatch lines than clipped lines", () => {
    const rect = { xMm: 10, yMm: 10, widthMm: 120, heightMm: 60 };
    expect(buildOffcutHatchLines(rect).length).toBeGreaterThan(clipOffcutHatchLines(rect).length);
  });
});
