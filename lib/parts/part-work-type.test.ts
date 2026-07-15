import { describe, expect, it } from "vitest";

import { isMarkingOnlyPart, partitionPartsByWorkType } from "@/lib/parts/part-work-type";

describe("part-work-type", () => {
  it("считает полный лист только маркировкой", () => {
    expect(isMarkingOnlyPart({ widthMm: 1250, heightMm: 3000 }, 1250, 3000)).toBe(true);
    expect(isMarkingOnlyPart({ widthMm: 3000, heightMm: 1250 }, 1250, 3000)).toBe(true);
    expect(isMarkingOnlyPart({ widthMm: 1250, heightMm: 2680 }, 1250, 3000)).toBe(false);
  });

  it("делит список на две группы", () => {
    const { cuttingAndMarking, markingOnly } = partitionPartsByWorkType(
      [
        { id: "a", widthMm: 1250, heightMm: 2680 },
        { id: "b", widthMm: 1250, heightMm: 3000 },
      ],
      1250,
      3000,
    );

    expect(cuttingAndMarking.map((p) => p.id)).toEqual(["a"]);
    expect(markingOnly.map((p) => p.id)).toEqual(["b"]);
  });
});
