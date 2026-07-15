import { AppPage } from "@/components/app-page";
import { CreateSheetFormatForm } from "@/components/catalog/create-sheet-format-form";
import { SiteHeader } from "@/components/site-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getActiveMaterialsForSelect,
  getSheetFormatsCatalog,
} from "@/features/catalog/queries";
import { requireAppRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SheetFormatsCatalogPage() {
  await requireAppRole("estimator");
  const [sheetFormats, materials] = await Promise.all([
    getSheetFormatsCatalog(),
    getActiveMaterialsForSelect(),
  ]);

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: "Справочники", href: "/catalog" },
            { label: "Форматы листов" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold">Форматы листов</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Размер заготовки под выбранный материал. Например, 1250×3000.
          </p>
        </div>

        <CreateSheetFormatForm materials={materials} />

        <div className="overflow-hidden rounded-xl border bg-card">
          {sheetFormats.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Форматов пока нет
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Название</TableHead>
                  <TableHead>Материал</TableHead>
                  <TableHead className="text-right">Ширина, мм</TableHead>
                  <TableHead className="text-right">Высота, мм</TableHead>
                  <TableHead className="pr-6 text-right">Толщина, мм</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheetFormats.map((sheet) => (
                  <TableRow key={sheet.id}>
                    <TableCell className="pl-6 font-medium">{sheet.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sheet.material.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sheet.widthMm}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sheet.heightMm}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {sheet.thicknessMm}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppPage>
  );
}
