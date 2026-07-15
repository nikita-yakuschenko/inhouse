import type { BarLayout, CuttingResult, PlacedPiece } from "@/lib/engine-bar/cutting";
import { groupConsecutiveIdenticalBars } from "@/lib/engine-bar/cutting";
import {
  filterLeadersByGap,
  nextPieceStartLeaders,
  staggerLeaders,
} from "@/lib/bar/dimension-leaders";
import { formatStockLengthsBadgeRu } from "@/lib/bar/stock-length-label-ru";
import type { jsPDF } from "jspdf";

/** Цвета сегментов — близко к палитре карты (chart / UI). */
const PIECE_RGB: [number, number, number][] = [
  [37, 99, 235],
  [22, 163, 74],
  [234, 88, 12],
  [147, 51, 234],
  [236, 72, 153],
  [202, 138, 4],
  [8, 145, 178],
  [79, 70, 229],
];

const FONT_VFS_NAME = "IBMPlexSans-Regular.ttf";
const FONT_NAME = "IBMPlexSans";

function uint8ToBase64(u8: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < u8.length; i += chunk) {
    const sub = u8.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(
      null,
      Array.from<number>(sub) as unknown as number[]
    );
  }
  return btoa(binary);
}

/** IBM Plex Sans из `public/fonts` — кириллица и цифры как в интерфейсе. */
async function embedIbmPlexSans(doc: jsPDF): Promise<void> {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/fonts/${FONT_VFS_NAME}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Не удалось загрузить шрифт для PDF (${res.status}). Проверьте наличие /fonts/${FONT_VFS_NAME}.`
    );
  }
  const buf = await res.arrayBuffer();
  doc.addFileToVFS(FONT_VFS_NAME, uint8ToBase64(new Uint8Array(buf)));
  doc.addFont(FONT_VFS_NAME, FONT_NAME, "normal");
  doc.setFont(FONT_NAME, "normal");
}

/** Кислотно красно-розовый для зоны пропила и меток реза в PDF. */
const CUT_MARK_RGB: [number, number, number] = [255, 45, 120];
const KERF_FILL_RGB: [number, number, number] = [255, 200, 220];

function aggregateLegend(pieces: PlacedPiece[]) {
  const map = new Map<
    string,
    { label: string; lengthMm: number; colorIndex: number; count: number }
  >();
  for (const p of pieces) {
    const prev = map.get(p.demandId);
    if (!prev) {
      map.set(p.demandId, {
        label: p.label,
        lengthMm: p.lengthMm,
        colorIndex: p.colorIndex,
        count: 1,
      });
    } else {
      prev.count += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.lengthMm - a.lengthMm);
}

function canShowPieceLabel(lengthMm: number, stockLengthMm: number): boolean {
  if (stockLengthMm <= 0) return false;
  const digits = String(Math.round(lengthMm)).length;
  const minFrac = 0.016 + digits * 0.0025;
  return lengthMm / stockLengthMm >= minFrac;
}

function drawDiagonalHatch(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  stepMm = 0.55
) {
  doc.setLineWidth(0.06);
  doc.setDrawColor(160, 160, 165);
  const span = w + h;
  for (let s = -h; s <= span; s += stepMm) {
    const x1 = x + s;
    const y1 = y + h;
    const x2 = x + s + h;
    const y2 = y;
    const clip = (cx: number, cy: number) =>
      cx >= x && cx <= x + w && cy >= y && cy <= y + h;
    if (x2 < x || x1 > x + w) continue;
    let ax1 = x1;
    let ay1 = y1;
    let ax2 = x2;
    let ay2 = y2;
    if (x1 < x) {
      const t = (x - x1) / (x2 - x1);
      ay1 = y1 + t * (y2 - y1);
      ax1 = x;
    }
    if (x2 > x + w) {
      const t = (x + w - x1) / (x2 - x1);
      ay2 = y1 + t * (y2 - y1);
      ax2 = x + w;
    }
    if (clip(ax1, ay1) || clip(ax2, ay2)) {
      doc.line(ax1, ay1, ax2, ay2);
    }
  }
}

/**
 * Метка под заготовкой: накопленная координата начала следующей детали.
 * Число сверху, линия слева, стрелка ◀ остриём в точку начала детали.
 */
function drawLeader(
  doc: jsPDF,
  xCut: number,
  yBarBottom: number,
  valueRounded: number,
  lane: 0 | 1,
  pageMargin: number,
) {
  const laneOffset = lane === 1 ? 5.8 : 0;
  const yLine = yBarBottom + 5.2 + laneOffset;
  const yText = yLine - 1.6;

  const armLen = 10;
  const tipW = 2.3;
  const tipH = 1.05;
  const tipX = xCut - tipW;
  const shaftStart = Math.max(pageMargin + 0.5, xCut - armLen);

  doc.setFontSize(7);
  doc.setTextColor(...CUT_MARK_RGB);
  doc.text(String(valueRounded), xCut - 0.4, yText, { align: "right" });

  doc.setDrawColor(...CUT_MARK_RGB);
  doc.setFillColor(...CUT_MARK_RGB);
  doc.setLineWidth(0.28);
  if (shaftStart < tipX - 0.2) {
    doc.line(shaftStart, yLine, tipX, yLine);
  }
  // ◀ / «-<»: остриё влево, плоская база у xCut
  doc.triangle(
    tipX,
    yLine,
    xCut,
    yLine - tipH,
    xCut,
    yLine + tipH,
    "F",
  );
}

function drawSchemeBlock(
  doc: jsPDF,
  result: CuttingResult,
  g: { count: number; bar: BarLayout; startIndex: number },
  margin: number,
  pageW: number,
  yStart: number
): number {
  const bar = g.bar;
  const L = bar.stockLengthMm;
  const kerfMm = result.kerfMm;
  const wasteMm = Math.max(0, bar.wasteMm);
  const barW = pageW - 2 * margin;
  const barH = 7.2;
  const r = 0.45;
  let y = yStart;

  const rangeLabel =
    g.count > 1
      ? `№ ${g.startIndex + 1}–${g.startIndex + g.count}`
      : `№ ${g.startIndex + 1}`;

  const legend = aggregateLegend(bar.pieces);
  const detailsStr =
    legend.length > 0
      ? legend
          .map((row) => {
            const name = row.label.trim() || `${row.lengthMm} мм`;
            return `${name} × ${row.count}`;
          })
          .join(", ")
      : "—";

  const prefix = `${g.count}×  ${rangeLabel} | Длина заготовки - ${L} мм | Детали - `;
  const maxContentW = pageW - 2 * margin;

  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);

  if (legend.length === 0) {
    const headerLines = doc.splitTextToSize(`${prefix}—`, maxContentW);
    doc.text(headerLines, margin, y);
    y += Math.max(5, headerLines.length * 4.2);
  } else {
    let estW = doc.getTextWidth(prefix);
    for (let i = 0; i < legend.length; i++) {
      const row = legend[i];
      const name = row.label.trim() || `${row.lengthMm} мм`;
      const seg = `${i > 0 ? ", " : ""} ${name} × ${row.count}`;
      estW += 1.35 + doc.getTextWidth(seg);
    }
    if (estW > maxContentW) {
      const headerMain = `${prefix}${detailsStr}`;
      const headerLines = doc.splitTextToSize(headerMain, maxContentW);
      doc.text(headerLines, margin, y);
      y += Math.max(5, headerLines.length * 4.2);
    } else {
      const lineY = y;
      let cx = margin;
      doc.text(prefix, cx, lineY);
      cx += doc.getTextWidth(prefix);
      for (let i = 0; i < legend.length; i++) {
        if (i > 0) {
          doc.text(", ", cx, lineY);
          cx += doc.getTextWidth(", ");
        }
        const row = legend[i];
        const [R, G, B] = PIECE_RGB[row.colorIndex % PIECE_RGB.length];
        doc.setFillColor(R, G, B);
        doc.rect(cx, lineY - 1.15, 1.25, 1.25, "F");
        doc.setTextColor(75, 85, 99);
        const name = row.label.trim() || `${row.lengthMm} мм`;
        const seg = ` ${name} × ${row.count}`;
        doc.text(seg, cx + 1.35, lineY);
        cx += 1.35 + doc.getTextWidth(seg);
      }
      y += 5;
    }
  }
  doc.text(
    `ост. ${bar.wasteMm.toFixed(0)} мм · занято ${bar.usedMm.toFixed(0)} мм`,
    margin,
    y
  );
  y += 5;

  const barTop = y;
  doc.setDrawColor(200, 200, 205);
  doc.setFillColor(244, 244, 246);
  doc.roundedRect(margin, barTop, barW, barH, r, r, "FD");

  let xPx = margin;

  for (let i = 0; i < bar.pieces.length; i++) {
    const p = bar.pieces[i];
    const segW = (p.lengthMm / L) * barW;
    const [R, G, B] = PIECE_RGB[p.colorIndex % PIECE_RGB.length];
    doc.setFillColor(R, G, B);
    doc.setDrawColor(220, 220, 225);
    doc.rect(xPx, barTop, segW, barH, "FD");
    if (canShowPieceLabel(p.lengthMm, L)) {
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);
      doc.text(String(Math.round(p.lengthMm)), xPx + segW / 2, barTop + barH / 2 + 1, {
        align: "center",
      });
    }
    xPx += segW;

    const hasKerfAfter = i < bar.pieces.length - 1 || wasteMm > 0;
    if (hasKerfAfter) {
      const kw = (kerfMm / L) * barW;
      doc.setFillColor(...KERF_FILL_RGB);
      doc.setDrawColor(...CUT_MARK_RGB);
      doc.setLineWidth(0.1);
      doc.rect(xPx, barTop, kw, barH, "FD");
      xPx += kw;
    }
  }

  if (wasteMm > 0 && bar.pieces.length > 0) {
    const ww = (wasteMm / L) * barW;
    doc.setFillColor(250, 250, 251);
    doc.setDrawColor(180, 180, 188);
    doc.setLineWidth(0.08);
    doc.setLineDashPattern([0.25, 0.35], 0);
    doc.roundedRect(xPx, barTop, ww, barH, r, r, "FD");
    doc.setLineDashPattern([], 0);
    drawDiagonalHatch(doc, xPx, barTop, ww, barH);
  }

  y = barTop + barH + 2;

  const leadersRaw = nextPieceStartLeaders(bar, kerfMm);
  const leadersFiltered = filterLeadersByGap(leadersRaw, L, 0.045);
  const leaders = staggerLeaders(leadersFiltered, L);
  const leaderZoneH = 20;
  const yBarBottom = barTop + barH;
  for (const Ld of leaders) {
    const xCut = margin + (Ld.anchorMm / L) * barW;
    drawLeader(doc, xCut, yBarBottom, Math.round(Ld.valueMm), Ld.lane, margin);
  }
  y = barTop + barH + leaderZoneH;

  return y;
}

/** Экспорт карты раскроя погонажа в PDF (клиентский вызов). */
export async function downloadBarCutPlanPdf(
  result: CuttingResult,
  title = "SmartCut — карта раскроя погонажа",
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await embedIbmPlexSans(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  doc.setFontSize(15);
  doc.setTextColor(15, 15, 20);
  doc.text(title, margin, y);
  y += 8;

  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 65);
  const meta = [
    `Заготовок (шт.): ${result.bars.length}`,
    `Полезная длина: ${Math.round(result.totalUsefulMm).toLocaleString("ru-RU")} мм из ${Math.round(result.totalStockMm).toLocaleString("ru-RU")} мм`,
    `Условные отходы: ~${result.wastePercent}%`,
    `Пропил: ${result.kerfMm} мм · резов между деталями: ${result.totalCuts}`,
    formatStockLengthsBadgeRu(result.bars.map((b) => b.stockLengthMm)),
  ];
  for (const line of meta) {
    doc.text(line, margin, y);
    y += 4.6;
  }
  y += 3;

  doc.setTextColor(15, 15, 20);
  doc.setFontSize(11);
  doc.text("Схема раскроя", margin, y);
  y += 7;

  const groups = groupConsecutiveIdenticalBars(result.bars);
  for (const g of groups) {
    const estH = 48;
    if (y > pageH - margin - estH) {
      doc.addPage();
      y = margin;
      await embedIbmPlexSans(doc);
    }
    y = drawSchemeBlock(doc, result, g, margin, pageW, y);
    y += 3;
  }

  doc.save(`smartcut-${new Date().toISOString().slice(0, 10)}.pdf`);
}
