import { describe, expect, it } from "vitest";
import { buildMaterialsSpecSummary } from "@/lib/cut-plan/materials-spec";
import type {
  ClientCutPlan,
  ClientPart,
  ClientSheetContext,
} from "@/features/projects/serialize-panels";

const sheetContext: ClientSheetContext = {
  label: "Плита ГСПВ",
  materialName: "Плита ГСПВ 1250x3000x12,5",
  sheetFormatName: "3000×1250",
  sheetWidthMm: 3000,
  sheetHeightMm: 1250,
  thicknessMm: 12.5,
};

function part(
  overrides: Partial<ClientPart> & Pick<ClientPart, "id" | "name">,
): ClientPart {
  return {
    code: null,
    widthMm: 100,
    heightMm: 100,
    quantity: 1,
    allowRotation: true,
    ...overrides,
  };
}

describe("buildMaterialsSpecSummary", () => {
  it("берёт отход из cutPlan.wastePercent, а не из площади заказа", () => {
    const parts: ClientPart[] = [
      part({ id: "p1", name: "A", widthMm: 500, heightMm: 500, quantity: 10 }),
      // Целые листы под маркировку увеличивают заказ, но не должны менять % отхода.
      part({
        id: "p2",
        name: "Маркировка",
        widthMm: 3000,
        heightMm: 1250,
        quantity: 14,
      }),
    ];
    const cutPlan = {
      id: "cp1",
      totalSheetsCount: 19,
      totalOperationsCount: 0,
      totalSetupChangesCount: 0,
      wastePercent: 9.2,
      sheets: [],
    } as ClientCutPlan;

    const spec = buildMaterialsSpecSummary(sheetContext, parts, cutPlan);

    expect(spec?.sheetsCount).toBe(33);
    expect(spec?.markingSheets).toBe(14);
    expect(spec?.cuttingSheets).toBe(19);
    expect(spec?.wastePercentLabel).toBe("9.2%");
  });

  it("без раскроя отход не показывает", () => {
    const parts: ClientPart[] = [
      part({ id: "p1", name: "A", widthMm: 500, heightMm: 500, quantity: 1 }),
    ];
    const spec = buildMaterialsSpecSummary(sheetContext, parts, null);
    expect(spec?.wastePercentLabel).toBeNull();
  });
});
