/** Преобразование координат движка (лист стоит, origin снизу-слева) в вид оператора:
 *  лист на схеме горизонтально — длинная сторона вдоль подачи на вертикальном станке. */

export type MmRect = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type MmPoint = {
  xMm: number;
  yMm: number;
};

/** Размеры листа на схеме оператора (ширина = бывшая высота листа). */
export function getOperatorSheetSize(sheetWidthMm: number, sheetHeightMm: number) {
  return {
    widthMm: sheetHeightMm,
    heightMm: sheetWidthMm,
  };
}

/** Поля вокруг заготовки на SVG-схеме (мм в координатах viewBox). */
export function getOperatorCanvasPaddingMm(sheetWidthMm: number, sheetHeightMm: number) {
  const sheet = getOperatorSheetSize(sheetWidthMm, sheetHeightMm);
  const shortSideMm = Math.min(sheet.widthMm, sheet.heightMm);
  return Math.max(100, Math.round(shortSideMm * 0.08));
}

/** ViewBox с безопасной зоной вокруг листа — заготовка не прижимается к краям канваса. */
export function getOperatorCanvasViewBox(sheetWidthMm: number, sheetHeightMm: number) {
  const sheet = getOperatorSheetSize(sheetWidthMm, sheetHeightMm);
  const paddingMm = getOperatorCanvasPaddingMm(sheetWidthMm, sheetHeightMm);

  return {
    paddingMm,
    xMm: -paddingMm,
    yMm: -paddingMm,
    widthMm: sheet.widthMm + paddingMm * 2,
    heightMm: sheet.heightMm + paddingMm * 2,
  };
}

/** Координаты оператора: origin снизу-слева, длина листа — по X (подача). */
export function engineRectToOperator(rect: MmRect): MmRect {
  return {
    xMm: rect.yMm,
    yMm: rect.xMm,
    widthMm: rect.heightMm,
    heightMm: rect.widthMm,
  };
}

export function enginePointToOperator(point: MmPoint): MmPoint {
  return {
    xMm: point.yMm,
    yMm: point.xMm,
  };
}

/** SVG: origin сверху-слева; нижний край листа = опора станка. */
export function operatorRectToSvg(rect: MmRect, operatorSheetHeightMm: number): MmRect {
  return {
    xMm: rect.xMm,
    yMm: operatorSheetHeightMm - rect.yMm - rect.heightMm,
    widthMm: rect.widthMm,
    heightMm: rect.heightMm,
  };
}

export function operatorPointToSvg(
  point: MmPoint,
  operatorSheetHeightMm: number,
): MmPoint {
  return {
    xMm: point.xMm,
    yMm: operatorSheetHeightMm - point.yMm,
  };
}

export function engineRectToOperatorSvg(rect: MmRect, sheetWidthMm: number): MmRect {
  return operatorRectToSvg(engineRectToOperator(rect), sheetWidthMm);
}

export function enginePointToOperatorSvg(
  point: MmPoint,
  sheetWidthMm: number,
): MmPoint {
  return operatorPointToSvg(enginePointToOperator(point), sheetWidthMm);
}

export function formatOperationHint(operation: {
  operationType: string;
  axis: string;
  x1Mm: number | null;
  y1Mm: number | null;
  x2Mm: number | null;
  y2Mm: number | null;
  note: string | null;
}): string {
  if (operation.note) {
    return operation.note;
  }

  if (operation.operationType === "full_cut" && operation.axis === "horizontal") {
    const y = operation.y1Mm ?? operation.y2Mm;
    if (y !== null) {
      const pos = enginePointToOperator({ xMm: 0, yMm: y });
      return `Поперечный рез на ${pos.xMm} мм от упора (вдоль ширины листа)`;
    }
  }

  if (operation.operationType === "full_cut" && operation.axis === "vertical") {
    const x = operation.x1Mm ?? operation.x2Mm;
    if (x !== null) {
      const pos = enginePointToOperator({ xMm: x, yMm: 0 });
      return `Продольный рез на ${pos.xMm} мм от упора`;
    }
  }

  if (operation.operationType === "trim_cut") {
    return "Подрезка кромки листа";
  }

  return operation.operationType;
}
