"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import {
  IconAlertCircle,
  IconDownload,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { CuttingBarDiagram } from "@/components/bar/bar-diagram";
import { HintTip } from "@/components/bar/hint-tip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CutCalculateButton } from "@/components/cut-plan/cut-calculate-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { saveAndCalculateBarProjectAction } from "@/features/bar-cut-plans/actions";
import type { BarWorkspaceSnapshot } from "@/features/projects/serialize-bar";
import { downloadBarCutPlanPdf } from "@/lib/bar/export-bar-cut-plan-pdf";
import {
  EXAMPLE_BLANKS,
  EXAMPLE_SEGMENTS,
  aggregateSegmentsByLength,
  formatMmForInput,
  parseBlanksPaste,
  parseSegmentsPaste,
  type ImportedSegment,
} from "@/lib/bar/import-parse";
import { formatStockLengthsBadgeRu } from "@/lib/bar/stock-length-label-ru";
import {
  MAX_EXACT_PIECES,
  groupConsecutiveIdenticalBars,
  type CuttingResult,
} from "@/lib/engine-bar/cutting";
import { ENTITY_ID_ALPHABET, ENTITY_ID_LENGTH } from "@/lib/id";

function newEntityId(): string {
  let id = "";
  const chars = ENTITY_ID_ALPHABET;
  for (let i = 0; i < ENTITY_ID_LENGTH; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return id;
}

type PieceRow = {
  id: string;
  label: string;
  outerMm: string;
  innerMm: string;
  qty: string;
};

type StockRow = {
  id: string;
  lengthMm: string;
  qty: string;
};

function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseLengthMm(s: string): number | null {
  const n = parseNum(s);
  if (n == null) return null;
  return Math.round(n);
}

function rowsFromSnapshot(snapshot: BarWorkspaceSnapshot): PieceRow[] {
  if (snapshot.segments.length === 0) {
    return [
      { id: newEntityId(), label: "Тип A", outerMm: "770", innerMm: "", qty: "1" },
      { id: newEntityId(), label: "Тип B", outerMm: "570", innerMm: "", qty: "1" },
    ];
  }
  return snapshot.segments.map((s) => ({
    id: s.id,
    label: s.label,
    outerMm: formatMmForInput(s.outerMm),
    innerMm: s.innerMm != null ? formatMmForInput(s.innerMm) : "",
    qty: String(s.quantity),
  }));
}

function stocksFromSnapshot(snapshot: BarWorkspaceSnapshot): StockRow[] {
  if (snapshot.stocks.length === 0) {
    return [{ id: newEntityId(), lengthMm: "6000", qty: "" }];
  }
  return snapshot.stocks.map((s) => ({
    id: s.id,
    lengthMm: formatMmForInput(s.lengthMm),
    qty: s.quantity == null ? "" : String(s.quantity),
  }));
}

function applyImportedSegments(
  parsed: ImportedSegment[],
  noticePrefix: string,
): { rows: PieceRow[]; notice: string } {
  const aggregated = aggregateSegmentsByLength(parsed);
  const rows = aggregated.map((r, i) => ({
    id: newEntityId(),
    label: r.name.trim() || `Тип ${i + 1}`,
    outerMm: formatMmForInput(r.lengthMm),
    innerMm: "",
    qty: String(r.quantity),
  }));
  const positions = parsed.length;
  const pieces = parsed.reduce((s, r) => s + r.quantity, 0);
  return {
    rows,
    notice: `${noticePrefix}: ${positions} поз. → ${aggregated.length} типов · ${pieces} дет.`,
  };
}

export function BarWorkspace({ initial }: { initial: BarWorkspaceSnapshot }) {
  const [rows, setRows] = useState<PieceRow[]>(() => rowsFromSnapshot(initial));
  const [stockRows, setStockRows] = useState<StockRow[]>(() =>
    stocksFromSnapshot(initial),
  );
  const [kerfMm, setKerfMm] = useState(String(initial.kerfMm));
  const [applyMiterStock, setApplyMiterStock] = useState(initial.applyMiter);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CuttingResult | null>(initial.result);
  const [importBlankText, setImportBlankText] = useState("");
  const [importSegmentText, setImportSegmentText] = useState("");
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"parts" | "cut" | "spec" | "params">(
    initial.result ? "cut" : "parts",
  );
  const [pending, startTransition] = useTransition();

  const miterInfo = useMemo(() => {
    let maxDeltaMm = 0;
    for (const r of rows) {
      const outer = parseLengthMm(r.outerMm);
      const inner = parseLengthMm(r.innerMm);
      if (outer == null || inner == null || inner <= 0) continue;
      const avgMm = (outer + inner) / 2;
      maxDeltaMm = Math.max(maxDeltaMm, outer - avgMm);
    }
    return { maxDeltaMm };
  }, [rows]);

  const tableStats = useMemo(() => {
    let pieces = 0;
    for (const r of rows) {
      const q = parseNum(r.qty);
      if (q != null && q > 0) pieces += q;
    }
    return { types: rows.length, pieces };
  }, [rows]);

  const totalPieces = tableStats.pieces;

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: newEntityId(),
        label: `Тип ${prev.length + 1}`,
        outerMm: "",
        innerMm: "",
        qty: "1",
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<PieceRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addStockRow() {
    setStockRows((prev) => [...prev, { id: newEntityId(), lengthMm: "", qty: "" }]);
  }

  function removeStockRow(id: string) {
    setStockRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function updateStockRow(id: string, patch: Partial<StockRow>) {
    setStockRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function handleImportBlanks() {
    setError(null);
    setImportNotice(null);
    setResult(null);
    const { rows: parsed, errors } = parseBlanksPaste(importBlankText);
    if (parsed.length === 0) {
      setError(
        errors[0] ??
          "Нет строк с длиной и количеством. Формат: длина (мм), количество, название…",
      );
      return;
    }
    setStockRows(
      parsed.map((p) => ({
        id: newEntityId(),
        lengthMm: formatMmForInput(p.lengthMm),
        qty: p.quantity === "infinity" ? "" : String(p.quantity),
      })),
    );
    setImportBlankText("");
    setImportNotice(`Импорт заготовок: ${parsed.length} строк`);
  }

  function handleImportSegments() {
    setError(null);
    setImportNotice(null);
    setResult(null);
    const { rows: parsed, errors } = parseSegmentsPaste(importSegmentText);
    if (parsed.length === 0) {
      setError(errors[0] ?? "Нет строк отрезков");
      return;
    }
    const applied = applyImportedSegments(parsed, "Вставка");
    setRows(applied.rows);
    setImportSegmentText("");
    setImportNotice(applied.notice);
  }

  function onBlankFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportBlankText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  function onSegmentTextFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportSegmentText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  async function onSegmentExcel(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const { parseSegmentsExcelBuffer } = await import(
        "@/lib/bar/import-segments-excel"
      );
      const { rows: parsed, errors } = parseSegmentsExcelBuffer(buf);
      if (parsed.length === 0) {
        setError(errors[0] ?? "В Excel нет отрезков");
        return;
      }
      setError(null);
      setResult(null);
      const applied = applyImportedSegments(parsed, `Файл «${file.name}»`);
      setRows(applied.rows);
      setImportSegmentText("");
      setImportNotice(applied.notice);
    } catch {
      setError("Не удалось прочитать Excel");
    }
  }

  function buildPayload() {
    const segments = [];
    for (const r of rows) {
      const outer = parseLengthMm(r.outerMm);
      const inner = parseLengthMm(r.innerMm);
      const q = parseNum(r.qty);
      if (outer == null || outer <= 0) {
        return { error: "Укажите положительную длину детали (мм)." };
      }
      if (q == null || !Number.isInteger(q) || q < 1) {
        return {
          error: `Количество для «${r.label}» должно быть целым числом ≥ 1.`,
        };
      }
      segments.push({
        id: r.id,
        label: r.label.trim() || "Деталь",
        outerMm: outer,
        innerMm: inner != null && inner > 0 ? inner : null,
        quantity: q,
      });
    }

    const stocks = [];
    for (let i = 0; i < stockRows.length; i++) {
      const row = stockRows[i]!;
      const mmLen = parseLengthMm(row.lengthMm);
      if (mmLen == null || mmLen <= 0) {
        return { error: `Заготовка (строка ${i + 1}): укажите длину в мм.` };
      }
      const t = row.qty.trim();
      let quantity: number | null = null;
      if (t !== "" && t !== "∞") {
        const n = parseNum(t);
        if (n == null || n < 1 || !Number.isInteger(n)) {
          return {
            error: `Количество заготовок (строка ${i + 1}): целое ≥ 1 или пусто (∞).`,
          };
        }
        quantity = n;
      }
      stocks.push({ id: row.id, lengthMm: mmLen, quantity });
    }

    const kerf = parseNum(kerfMm) ?? 0;
    if (kerf < 0) return { error: "Пропил не может быть отрицательным" };

    return {
      payload: {
        projectId: initial.projectId,
        kerfMm: kerf,
        applyMiter: applyMiterStock,
        segments,
        stocks,
      },
    };
  }

  function handleCalculate() {
    setError(null);
    const built = buildPayload();
    if ("error" in built && built.error) {
      setError(built.error);
      return;
    }
    const payload = built.payload!;
    startTransition(async () => {
      const res = await saveAndCalculateBarProjectAction(payload);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      setMainTab("cut");
      toast.success("Раскрой погонажа рассчитан", {
        description:
          res.result.method === "exact"
            ? `Точный алгоритм · ${res.result.bars.length} заг.`
            : `FFD · ${res.result.bars.length} заг.`,
      });
    });
  }

  const groups = result ? groupConsecutiveIdenticalBars(result.bars) : [];

  const stockSpecRows = useMemo(() => {
    if (!result) return [];
    const map = new Map<number, number>();
    for (const bar of result.bars) {
      map.set(bar.stockLengthMm, (map.get(bar.stockLengthMm) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([lengthMm, count]) => ({ lengthMm, count }));
  }, [result]);

  const projectTitle = initial.contractNumber
    ? `${initial.projectName} · ${initial.contractNumber}`
    : initial.projectName;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{projectTitle}</p>
          <p className="text-xs text-muted-foreground">
            {tableStats.types} типов · {tableStats.pieces} дет.
          </p>
        </div>
        {result ? (
          <>
            <Badge variant="secondary">
              {result.method === "exact" ? "Точный" : "FFD"} · {result.bars.length}{" "}
              заг.
            </Badge>
            <Badge variant="secondary">Отход ~{result.wastePercent}%</Badge>
          </>
        ) : (
          <Badge variant="outline">Раскрой не рассчитан</Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <Tabs
          value={mainTab}
          onValueChange={(v) =>
            setMainTab(v as "parts" | "cut" | "spec" | "params")
          }
          className="flex h-full min-h-0 flex-col"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="parts">Детали</TabsTrigger>
              <TabsTrigger value="cut">Карта раскроя</TabsTrigger>
              <TabsTrigger value="spec">Спецификация</TabsTrigger>
              <TabsTrigger value="params">Параметры раскроя</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!result}
                onClick={() =>
                  result &&
                  downloadBarCutPlanPdf(
                    result,
                    `${initial.projectName}${initial.contractNumber ? ` · ${initial.contractNumber}` : ""}`,
                  )
                }
              >
                <IconDownload className="size-4" />
                Скачать PDF
              </Button>
              <CutCalculateButton pending={pending} onClick={handleCalculate} />
            </div>
          </div>

          {(error || importNotice) && (
            <div className="mt-3 space-y-2">
              {error && (
                <Alert variant="destructive">
                  <IconAlertCircle />
                  <AlertTitle>Ошибка</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {importNotice && (
                <p className="text-xs text-muted-foreground">{importNotice}</p>
              )}
            </div>
          )}

          <TabsContent value="parts" className="mt-4 min-h-0 flex-1 space-y-4">
            <div className="space-y-2">
              <Label>Вставка отрезков (буфер)</Label>
              <p className="text-xs text-muted-foreground">
                Вставьте текст и нажмите «Импорт» — строки попадут в таблицу.
                Буфер в проекте не сохраняется.
              </p>
              <Textarea
                value={importSegmentText}
                onChange={(e) => setImportSegmentText(e.target.value)}
                placeholder={`Пример формата:\n${EXAMPLE_SEGMENTS}`}
                className="h-[100px] resize-none font-mono text-sm"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleImportSegments}
                >
                  Импорт отрезков
                </Button>
                <Label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
                  .txt/.csv
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv"
                    className="hidden"
                    onChange={onSegmentTextFile}
                  />
                </Label>
                <Label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
                  Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={onSegmentExcel}
                  />
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Отрезки</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <IconPlus className="mr-1 size-4" />
                  Строка
                </Button>
              </div>
              <div className="max-h-[min(28rem,50vh)] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Наруж.</TableHead>
                      <TableHead>Внутр.</TableHead>
                      <TableHead>Кол</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Input
                            value={r.label}
                            onChange={(e) =>
                              updateRow(r.id, { label: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            value={r.outerMm}
                            onChange={(e) =>
                              updateRow(r.id, { outerMm: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            value={r.innerMm}
                            onChange={(e) =>
                              updateRow(r.id, { innerMm: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="numeric"
                            value={r.qty}
                            onChange={(e) =>
                              updateRow(r.id, { qty: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(r.id)}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Деталей: {totalPieces}
                {totalPieces <= MAX_EXACT_PIECES
                  ? ` · до ${MAX_EXACT_PIECES} — точный алгоритм`
                  : " · FFD (точный лимит превышен)"}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="cut" className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {!result ? (
              <div className="flex h-[min(24rem,60vh)] items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Заполните детали и параметры, затем нажмите «Рассчитать раскрой»
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">
                    {result.method === "exact" ? "Точный" : "FFD"} ·{" "}
                    {result.bars.length} заг.
                  </Badge>
                  <Badge variant="outline">отходы ~{result.wastePercent}%</Badge>
                  <Badge variant="outline">
                    {formatStockLengthsBadgeRu(
                      result.bars.map((b) => b.stockLengthMm),
                    )}
                  </Badge>
                </div>
                {groups.map((g) => (
                  <CuttingBarDiagram
                    key={`${g.startIndex}-${g.count}`}
                    bar={g.bar}
                    repeat={g.count}
                    kerfMm={result.kerfMm}
                    displayIndex={g.startIndex + 1}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="spec" className="mt-4 min-h-0 flex-1">
            {!result ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Выполните расчёт — спецификация заготовок появится здесь
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-base font-semibold">Спецификация заготовок</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Сколько погонных заготовок нужно по результатам раскроя.
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">№</TableHead>
                        <TableHead>Длина заготовки</TableHead>
                        <TableHead className="pr-6 text-right">Кол-во, шт.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockSpecRows.map((row, i) => (
                        <TableRow key={row.lengthMm}>
                          <TableCell className="pl-6 tabular-nums">{i + 1}</TableCell>
                          <TableCell className="tabular-nums font-medium">
                            {row.lengthMm} мм
                          </TableCell>
                          <TableCell className="pr-6 text-right tabular-nums">
                            {row.count}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="pl-6 font-medium" colSpan={2}>
                          Итого
                        </TableCell>
                        <TableCell className="pr-6 text-right font-medium tabular-nums">
                          {result.bars.length}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  Полезная длина:{" "}
                  {Math.round(result.totalUsefulMm).toLocaleString("ru-RU")} мм из{" "}
                  {Math.round(result.totalStockMm).toLocaleString("ru-RU")} мм ·
                  отход ~{result.wastePercent}%
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="params" className="mt-4 min-h-0 flex-1 space-y-4">
            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle>Параметры раскроя</CardTitle>
                <CardDescription>
                  Пропил, склад заготовок и сводка последнего расчёта.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="kerf">Пропил (мм)</Label>
                    <HintTip label="Метки реза">
                      На карте цифра — накопленная длина до начала следующей
                      детали: конец предыдущей + полный пропил (округление до мм).
                      Для 355 и пропила 3,5 это 359, не 357.
                    </HintTip>
                  </div>
                  <Input
                    id="kerf"
                    inputMode="decimal"
                    value={kerfMm}
                    onChange={(e) => setKerfMm(e.target.value)}
                    className="max-w-xs"
                  />
                </div>

                {miterInfo.maxDeltaMm > 0 && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="miter-stock"
                      checked={applyMiterStock}
                      onCheckedChange={(v) => setApplyMiterStock(v === true)}
                    />
                    <div className="grid gap-1">
                      <Label htmlFor="miter-stock">
                        Коррекция заготовки по фаскам
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Вычесть {miterInfo.maxDeltaMm.toFixed(0)} мм из длины каждой
                        заготовки.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label>Заготовки (склад)</Label>
                      <HintTip label="Несколько длин">
                        Каждая строка — свой тип заготовки. Пустое количество или
                        ∞ — без лимита.
                      </HintTip>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStockRow}
                    >
                      <IconPlus className="mr-1 size-4" />
                      Тип
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Длина (мм)</TableHead>
                          <TableHead>Кол-во</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockRows.map((sr) => (
                          <TableRow key={sr.id}>
                            <TableCell>
                              <Input
                                inputMode="decimal"
                                value={sr.lengthMm}
                                onChange={(e) =>
                                  updateStockRow(sr.id, {
                                    lengthMm: e.target.value,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                inputMode="numeric"
                                placeholder="∞"
                                value={sr.qty}
                                onChange={(e) =>
                                  updateStockRow(sr.id, { qty: e.target.value })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={stockRows.length <= 1}
                                onClick={() => removeStockRow(sr.id)}
                              >
                                <IconTrash className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Textarea
                    value={importBlankText}
                    onChange={(e) => setImportBlankText(e.target.value)}
                    placeholder={`Пример формата:\n${EXAMPLE_BLANKS}`}
                    className="h-[72px] resize-none font-mono text-xs"
                    spellCheck={false}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleImportBlanks}
                    >
                      Импорт заготовок
                    </Button>
                    <Label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
                      Файл заготовок
                      <input
                        type="file"
                        accept=".txt,.csv,.tsv"
                        className="hidden"
                        onChange={onBlankFile}
                      />
                    </Label>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4 text-sm">
                  {result ? (
                    <>
                      <p>
                        Метод:{" "}
                        {result.method === "exact"
                          ? "точный (минимум заготовок)"
                          : "FFD"}
                      </p>
                      <p>Заготовок: {result.bars.length}</p>
                      <p>
                        Полезная длина:{" "}
                        {Math.round(result.totalUsefulMm).toLocaleString("ru-RU")} мм
                        из {Math.round(result.totalStockMm).toLocaleString("ru-RU")} мм
                      </p>
                      <p>Условные отходы: ~{result.wastePercent}%</p>
                      <p>
                        Пропил: {result.kerfMm} мм · резов между деталями:{" "}
                        {result.totalCuts}
                      </p>
                      <p>
                        Метки реза — накопленная координата{" "}
                        <strong>начала следующей детали</strong> (конец предыдущей
                        + пропил), округлённая до мм.
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      После расчёта здесь появится сводка результатов.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
