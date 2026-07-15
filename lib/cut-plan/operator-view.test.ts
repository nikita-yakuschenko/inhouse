import { describe, expect, it } from "vitest";
import {
  enginePointToOperator,
  enginePointToOperatorSvg,
  engineRectToOperator,
  engineRectToOperatorSvg,
  getOperatorCanvasPaddingMm,
  getOperatorCanvasViewBox,
  getOperatorSheetSize,
} from "@/lib/cut-plan/operator-view";

describe("operator-view", () => {
  it("оставляет лист альбомным как на станке", () => {
    expect(getOperatorSheetSize(2500, 1250)).toEqual({
      widthMm: 2500,
      heightMm: 1250,
    });
  });

  it("adds safe padding around sheet in viewBox", () => {
    expect(getOperatorCanvasPaddingMm(2500, 1250)).toBe(100);
    expect(getOperatorCanvasViewBox(2500, 1250)).toEqual({
      paddingMm: 100,
      xMm: -100,
      yMm: -100,
      widthMm: 2700,
      heightMm: 1450,
    });
  });

  it("maps engine coords without axis swap", () => {
    const part = engineRectToOperator({
      xMm: 0,
      yMm: 0,
      widthMm: 900,
      heightMm: 400,
    });
    expect(part).toEqual({
      xMm: 0,
      yMm: 0,
      widthMm: 900,
      heightMm: 400,
    });
  });

  it("places bottom-left part at bottom of svg", () => {
    const part = engineRectToOperatorSvg(
      {
        xMm: 0,
        yMm: 0,
        widthMm: 900,
        heightMm: 400,
      },
      1250,
    );
    expect(part).toEqual({
      xMm: 0,
      yMm: 850,
      widthMm: 900,
      heightMm: 400,
    });
  });

  it("maps offcut above part higher on sheet to top of svg", () => {
    const offcut = engineRectToOperatorSvg(
      {
        xMm: 0,
        yMm: 400,
        widthMm: 900,
        heightMm: 850,
      },
      1250,
    );
    expect(offcut).toEqual({
      xMm: 0,
      yMm: 0,
      widthMm: 900,
      heightMm: 850,
    });
  });

  it("maps point near fence to bottom of svg", () => {
    const cut = enginePointToOperatorSvg({ xMm: 900, yMm: 0 }, 1250);
    expect(cut).toEqual({ xMm: 900, yMm: 1250 });
  });

  it("keeps feed position on X for horizontal cut hint", () => {
    const cut = enginePointToOperator({ xMm: 0, yMm: 400 });
    expect(cut.yMm).toBe(400);
  });
});
