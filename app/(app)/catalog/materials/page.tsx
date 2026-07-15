import { AppPage } from "@/components/app-page";
import { CreateMaterialForm } from "@/components/catalog/create-material-form";
import { SiteHeader } from "@/components/site-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMaterialsCatalog } from "@/features/catalog/queries";
import { requireAppRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MaterialsCatalogPage() {
  await requireAppRole("estimator");
  const materials = await getMaterialsCatalog();

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
            Добавьте материал, затем задайте формат листа в «Форматы листов».
          </p>
        </div>

        <CreateMaterialForm />

        <div className="overflow-hidden rounded-xl border bg-card">
          {materials.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Материалов пока нет
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Название</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Толщина, мм</TableHead>
                  <TableHead className="pr-6 text-right">Форматов</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="pl-6 font-medium">{material.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {material.materialType}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {material.thicknessMm}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {material._count.sheetFormats}
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
