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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [mainTab, setMainTab] = useState<"map" | "params">("map");
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
      toast.success("Раскрой погонажа рассчитан", {
        description:
          res.result.method === "exact"
            ? `Точный алгоритм · ${res.result.bars.length} заг.`
            : `FFD · ${res.result.bars.length} заг.`,
      });
    });
  }

  const groups = result ? groupConsecutiveIdenticalBars(result.bars) : [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex max-h-[55vh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b lg:max-h-none lg:h-full lg:w-[28rem] lg:border-r lg:border-b-0">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-base font-semibold tracking-tight">Исходные параметры</h2>
          <Badge variant="outline" className="font-normal tabular-nums">
            типов {tableStats.types} · дет. {tableStats.pieces}
          </Badge>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="space-y-2">
          <Label>Вставка отрезков (буфер)</Label>
          <p className="text-xs text-muted-foreground">
            Сюда вставляете текст и жмёте «Импорт» — строки попадают в таблицу
            ниже. Само поле буфера не хранится в проекте.
          </p>
          <Textarea
            value={importSegmentText}
            onChange={(e) => setImportSegmentText(e.target.value)}
            placeholder={`Пример формата:\n${EXAMPLE_SEGMENTS}`}
            className="h-[100px] resize-none font-mono text-sm"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleImportSegments}>
              Импорт отрезков
            </Button>
            <Label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
              .txt/.csv
              <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={onSegmentTextFile} />
            </Label>
            <Label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
              Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onSegmentExcel} />
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label>Заготовки (склад)</Label>
              <HintTip label="Несколько длин">
                Каждая строка — свой тип заготовки. Пустое количество или ∞ — без
                лимита. Алгоритм берёт наименьшую подходящую длину.
              </HintTip>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addStockRow}>
              <IconPlus className="mr-1 size-4" />
              Тип
            </Button>
          </div>
          <div className="max-h-40 overflow-auto rounded-md border">
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
                          updateStockRow(sr.id, { lengthMm: e.target.value })
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
            <Button type="button" variant="secondary" size="sm" onClick={handleImportBlanks}>
              Импорт заготовок
            </Button>
            <Label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
              Файл заготовок
              <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={onBlankFile} />
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="kerf">Пропил (мм)</Label>
            <HintTip label="Метки реза">
              На карте цифра — накопленная длина до начала следующей детали: конец
              предыдущей + полный пропил (округление до мм). Для 355 и пропила 3,5
              это 359, не 357.
            </HintTip>
          </div>
          <Input
            id="kerf"
            inputMode="decimal"
            value={kerfMm}
            onChange={(e) => setKerfMm(e.target.value)}
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
              <Label htmlFor="miter-stock">Коррекция заготовки по фаскам</Label>
              <p className="text-xs text-muted-foreground">
                Вычесть {miterInfo.maxDeltaMm.toFixed(0)} мм из длины каждой
                заготовки (как в калькуляторе погонажа).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Отрезки (таблица)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <IconPlus className="mr-1 size-4" />
              Строка
            </Button>
          </div>
          <div className="max-h-64 overflow-auto rounded-md border">
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
                        onChange={(e) => updateRow(r.id, { label: e.target.value })}
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
                        onChange={(e) => updateRow(r.id, { qty: e.target.value })}
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

        <div className="shrink-0 border-t bg-background px-4 py-3">
          <Button
            type="button"
            className="w-full"
            disabled={pending}
            onClick={handleCalculate}
          >
            {pending ? "Расчёт…" : "Рассчитать раскрой"}
          </Button>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-4">
        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as "map" | "params")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="map">Карта раскроя</TabsTrigger>
              <TabsTrigger value="params">Параметры расчёта</TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!result}
              onClick={() =>
                result &&
                downloadBarCutPlanPdf(
                  result,
                  `${initial.projectName}${initial.contractNumber ? ` · ${initial.contractNumber}` : ""}`,
                )
              }
            >
              <IconDownload className="mr-1 size-4" />
              Скачать PDF
            </Button>
          </div>

          <TabsContent value="map" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            {!result ? (
              <Card>
                <CardHeader>
                  <CardTitle>Нет результата</CardTitle>
                  <CardDescription>
                    Сначала выполните расчёт кнопкой в панели слева.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">
                    {result.method === "exact" ? "Точный" : "FFD"} · {result.bars.length}{" "}
                    заг.
                  </Badge>
                  <Badge variant="outline">
                    отходы ~{result.wastePercent}%
                  </Badge>
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

          <TabsContent value="params" className="mt-0 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Параметры расчёта</CardTitle>
                <CardDescription>
                  Сводка после последнего успешного запуска.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result ? (
                  <>
                    <p>Метод: {result.method === "exact" ? "точный (минимум заготовок)" : "FFD"}</p>
                    <p>Заготовок: {result.bars.length}</p>
                    <p>
                      Полезная длина: {Math.round(result.totalUsefulMm).toLocaleString("ru-RU")} мм из{" "}
                      {Math.round(result.totalStockMm).toLocaleString("ru-RU")} мм
                    </p>
                    <p>Условные отходы: ~{result.wastePercent}%</p>
                    <p>Пропил: {result.kerfMm} мм · резов между деталями: {result.totalCuts}</p>
                    <p>
                      Метки реза — накопленная координата{" "}
                      <strong>начала следующей детали</strong> (конец предыдущей +
                      пропил), округлённая до мм. При детали 355 и пропиле 3,5:
                      355 + 3,5 → 359.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Пока нет сохранённого результата.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
