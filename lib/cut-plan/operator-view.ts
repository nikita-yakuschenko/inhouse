/** Координаты движка → вид оператора: лист на станке горизонтально (альбом).
 *  Origin движка снизу-слева; SVG — сверху-слева, нижний край листа = опора. */

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

/** Размеры листа на схеме: как на станке, без поворота осей. */
export function getOperatorSheetSize(sheetWidthMm: number, sheetHeightMm: number) {
  return {
    widthMm: sheetWidthMm,
    heightMm: sheetHeightMm,
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

/** Без смены осей: X вдоль длины листа, Y от нижнего упора вверх. */
export function engineRectToOperator(rect: MmRect): MmRect {
  return { ...rect };
}

export function enginePointToOperator(point: MmPoint): MmPoint {
  return { ...point };
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

/** sheetHeightMm — высота листа в мм (для переворота оси Y в SVG). */
export function engineRectToOperatorSvg(rect: MmRect, sheetHeightMm: number): MmRect {
  return operatorRectToSvg(engineRectToOperator(rect), sheetHeightMm);
}

export function enginePointToOperatorSvg(
  point: MmPoint,
  sheetHeightMm: number,
): MmPoint {
  return operatorPointToSvg(enginePointToOperator(point), sheetHeightMm);
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
      return `Поперечный рез на ${y} мм от упора`;
    }
  }

  if (operation.operationType === "full_cut" && operation.axis === "vertical") {
    const x = operation.x1Mm ?? operation.x2Mm;
    if (x !== null) {
      return `Продольный рез на ${x} мм от упора`;
    }
  }

  if (operation.operationType === "trim_cut") {
    return "Подрезка кромки листа";
  }

  return operation.operationType;
}
