import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  extractPanelCode,
  parseSpecificationXlsx,
} from "@/lib/parts/parse-specification-xlsx";

describe("parseSpecificationXlsx", () => {
  it("парсит панели и детали: панель Ст-1-02, деталь Ст-1-02-01", () => {
    const buffer = readFileSync(
      resolve(process.cwd(), "Ст- - Спецификация плитной обшивки.xlsx"),
    );

    const parts = parseSpecificationXlsx(buffer);

    expect(parts.length).toBeGreaterThan(30);
    expect(parts[0]).toEqual({
      panelName: "Плитная обшивка внешняя Ст-1-02",
      panelCode: "Ст-1-02",
      code: "Ст-1-02-01",
      name: "Плитная обшивка внешняя Ст-1-02",
      widthMm: 1250,
      heightMm: 2680,
      quantity: 2,
    });

    const panelCodes = new Set(parts.map((part) => part.panelCode));
    expect(panelCodes.size).toBeGreaterThan(1);
  });

  it("извлекает код панели из названия", () => {
    expect(extractPanelCode("Плитная обшивка внешняя Ст-1-02")).toBe("Ст-1-02");
    expect(extractPanelCode("Ст-2-11")).toBe("Ст-2-11");
    expect(extractPanelCode("без кода")).toBeNull();
  });
});
