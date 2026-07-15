import { describe, expect, it } from "vitest";

import {
  EXAMPLE_SEGMENTS,
  aggregateSegmentsByLength,
  formatMmForInput,
  parseBlanksPaste,
  parseSegmentsPaste,
} from "@/lib/bar/import-parse";
import { parseSegmentsExcelBuffer } from "@/lib/bar/import-segments-excel";
import { formatStockLengthsBadgeRu, metersNounRu } from "@/lib/bar/stock-length-label-ru";
import * as XLSX from "xlsx";

describe("import-parse / parseBlanksPaste", () => {
  it("разбирает заготовки и ∞", () => {
    const { rows, errors } = parseBlanksPaste("6000\t5\tТруба\n12000\t∞\tТруба2");
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([
      {
        lengthMm: 6000,
        quantity: 5,
        name: "Труба",
        priority: 0,
        material: "",
        cost: null,
      },
      {
        lengthMm: 12000,
        quantity: "infinity",
        name: "Труба2",
        priority: 0,
        material: "",
        cost: null,
      },
    ]);
  });
});

describe("import-parse / parseSegmentsPaste", () => {
  it("разбирает пример отрезков", () => {
    const { rows, errors } = parseSegmentsPaste(EXAMPLE_SEGMENTS);
    expect(errors).toHaveLength(0);
    expect(rows.map((r) => r.lengthMm)).toEqual([1500, 800, 1200]);
  });

  it("агрегирует одинаковые длины", () => {
    const agg = aggregateSegmentsByLength([
      { lengthMm: 1000, quantity: 2, name: "A", material: "" },
      { lengthMm: 1000, quantity: 3, name: "", material: "" },
      { lengthMm: 500, quantity: 1, name: "B", material: "" },
    ]);
    expect(agg).toEqual([
      { lengthMm: 1000, quantity: 5, name: "A", material: "" },
      { lengthMm: 500, quantity: 1, name: "B", material: "" },
    ]);
  });
});

describe("import-parse / formatMmForInput", () => {
  it("целые мм без дроби", () => {
    expect(formatMmForInput(1429)).toBe("1429");
  });
});

describe("import-segments-excel", () => {
  it("читает A=длина, B=qty из буфера", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Длина", "Кол-во", "Имя"],
      [2500, 2, "Отрезок"],
      [1800, 1, ""],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const binary = XLSX.write(wb, { type: "binary", bookType: "xlsx" }) as string;
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      u8[i] = binary.charCodeAt(i) & 0xff;
    }

    const { rows, errors } = parseSegmentsExcelBuffer(u8);
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([
      { lengthMm: 2500, quantity: 2, name: "Отрезок", material: "" },
      { lengthMm: 1800, quantity: 1, name: "", material: "" },
    ]);
  });
});

describe("stock-length-label-ru", () => {
  it("склоняет метры", () => {
    expect(metersNounRu(1)).toBe("метр");
    expect(metersNounRu(2)).toBe("метра");
    expect(metersNounRu(5)).toBe("метров");
    expect(metersNounRu(11)).toBe("метров");
  });

  it("бейдж одной и нескольких заготовок", () => {
    expect(formatStockLengthsBadgeRu([6000])).toBe("Заготовка — 6 метров");
    expect(formatStockLengthsBadgeRu([6000, 5000, 4000])).toBe(
      "Заготовка — 6, 5, 4 метра",
    );
  });
});
