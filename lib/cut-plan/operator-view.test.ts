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
  it("rotates sheet to landscape for operator", () => {
    expect(getOperatorSheetSize(1250, 2500)).toEqual({
      widthMm: 2500,
      heightMm: 1250,
    });
  });

  it("adds safe padding around sheet in viewBox", () => {
    expect(getOperatorCanvasPaddingMm(1250, 2500)).toBe(100);
    expect(getOperatorCanvasViewBox(1250, 2500)).toEqual({
      paddingMm: 100,
      xMm: -100,
      yMm: -100,
      widthMm: 2700,
      heightMm: 1450,
    });
  });

  it("maps bottom part to left strip at bottom in operator coords", () => {
    const part = engineRectToOperator({
      xMm: 0,
      yMm: 0,
      widthMm: 900,
      heightMm: 1330,
    });
    expect(part).toEqual({
      xMm: 0,
      yMm: 0,
      widthMm: 1330,
      heightMm: 900,
    });
  });

  it("places bottom-left part at bottom of svg", () => {
    const part = engineRectToOperatorSvg(
      {
        xMm: 0,
        yMm: 0,
        widthMm: 900,
        heightMm: 1330,
      },
      1250,
    );
    expect(part).toEqual({
      xMm: 0,
      yMm: 350,
      widthMm: 1330,
      heightMm: 900,
    });
  });

  it("maps offcut along feed to right of part in svg", () => {
    const offcut = engineRectToOperatorSvg(
      {
        xMm: 0,
        yMm: 1330,
        widthMm: 900,
        heightMm: 1170,
      },
      1250,
    );
    expect(offcut).toEqual({
      xMm: 1330,
      yMm: 350,
      widthMm: 1170,
      heightMm: 900,
    });
  });

  it("maps depth cut to horizontal line in svg", () => {
    const cut = enginePointToOperatorSvg({ xMm: 900, yMm: 0 }, 1250);
    expect(cut).toEqual({ xMm: 0, yMm: 350 });
  });

  it("maps horizontal cut position from fence in operator coords", () => {
    const cut = enginePointToOperator({ xMm: 0, yMm: 1330 });
    expect(cut.xMm).toBe(1330);
  });
});
