import { describe, expect, it } from "vitest";

import {
  extractPanelCode,
  extractWallMark,
  countUniqueWallMarks,
  formatPartMarkingLabel,
  resolvePartMarking,
} from "@/lib/parts/part-marking";

describe("resolvePartMarking", () => {
  it("собирает Ст-1-01-02 из панели и маркировки 02", () => {
    expect(
      resolvePartMarking("Плитная обшивка внешняя Ст-1-01", "02"),
    ).toBe("Ст-1-01-02");
  });

  it("оставляет уже полный код", () => {
    expect(
      resolvePartMarking("Плитная обшивка внешняя Ст-1-01", "Ст-1-01-02"),
    ).toBe("Ст-1-01-02");
  });

  it("на карте для qty=1 пишет только код без -1", () => {
    expect(formatPartMarkingLabel("Ст-1-01-02", 1, 1)).toBe("Ст-1-01-02");
  });

  it("извлекает код панели", () => {
    expect(extractPanelCode("Плитная обшивка внешняя Ст-1-02")).toBe("Ст-1-02");
  });

  it("извлекает марку стены из кода детали", () => {
    expect(extractWallMark("Плита", "Ст-1-02-01")).toBe("Ст-1-02");
    expect(extractWallMark("Плита Ст-1-03", "04")).toBe("Ст-1-03");
  });

  it("считает уникальные марки стен", () => {
    expect(
      countUniqueWallMarks([
        { name: "a", code: "Ст-1-01-01" },
        { name: "b", code: "Ст-1-01-02" },
        { name: "c", code: "Ст-1-02-01" },
        { name: "d", code: "Ст-1-02-03" },
      ]),
    ).toBe(2);
  });
});
