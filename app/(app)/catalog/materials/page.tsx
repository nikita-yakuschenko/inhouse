import { AppPage } from "@/components/app-page";
import { CreateMaterialForm } from "@/components/catalog/create-material-form";
import { DeleteMaterialButton } from "@/components/catalog/delete-material-button";
import { SiteHeader } from "@/components/site-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSheetFormatsCatalog } from "@/features/catalog/queries";
import { requireAppRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MaterialsCatalogPage() {
  await requireAppRole("estimator");
  const sheets = await getSheetFormatsCatalog();

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: "Справочники", href: "/catalog" },
            { label: "Материалы" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold">Материалы</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Листовой материал целиком: название, толщина и размер листа.
          </p>
        </div>

        <CreateMaterialForm />

        <div className="overflow-hidden rounded-xl border bg-card">
          {sheets.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Материалов пока нет
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Название</TableHead>
                  <TableHead className="text-right">По станку, мм</TableHead>
                  <TableHead className="text-right">От упора, мм</TableHead>
                  <TableHead className="text-right">Толщина, мм</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((sheet) => (
                  <TableRow key={sheet.id}>
                    <TableCell className="pl-6 font-medium">
                      {sheet.material.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sheet.widthMm}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sheet.heightMm}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(sheet.thicknessMm)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <DeleteMaterialButton
                        sheetFormatId={sheet.id}
                        materialName={sheet.material.name}
                      />
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
