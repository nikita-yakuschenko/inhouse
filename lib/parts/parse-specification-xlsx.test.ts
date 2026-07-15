import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSpecificationXlsx } from "@/lib/parts/parse-specification-xlsx";

describe("parseSpecificationXlsx", () => {
  it("парсит спецификацию плитной обшивки из xlsx", () => {
    const buffer = readFileSync(
      resolve(process.cwd(), "Ст- - Спецификация плитной обшивки.xlsx"),
    );

    const parts = parseSpecificationXlsx(buffer);

    expect(parts.length).toBeGreaterThan(30);
    expect(parts[0]).toEqual({
      code: "01",
      name: "Ст- [01]",
      widthMm: 1250,
      heightMm: 2680,
      quantity: 2,
    });
    expect(parts.at(-1)).toEqual({
      code: "08",
      name: "Ст- [08]",
      widthMm: 1250,
      heightMm: 3000,
      quantity: 1,
    });
  });

  it("использует переданный префикс названия", () => {
    const buffer = readFileSync(
      resolve(process.cwd(), "Ст- - Спецификация плитной обшивки.xlsx"),
    );

    const parts = parseSpecificationXlsx(buffer, { namePrefix: "П(Ц)-1" });

    expect(parts[0]?.name).toBe("П(Ц)-1 [01]");
  });
});
