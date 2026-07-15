import { describe, expect, it } from "vitest";

import {
  extractPanelCode,
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
});
