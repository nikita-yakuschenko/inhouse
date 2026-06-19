import { redirect } from "next/navigation";

import { AppPage } from "@/components/app-page";
import { EstimatorCalculationsTable } from "@/components/projects/estimator-calculations-table";
import { NewCalculationSheet } from "@/components/projects/new-calculation-sheet";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalogDefaults, getProjects } from "@/features/projects/queries";
import { serializeProjectListRows } from "@/features/projects/serialize-project-list";
import { getAppRole } from "@/lib/auth/session";
import { getWorkspaceLabels } from "@/lib/auth/workspace-labels";

export const dynamic = "force-dynamic";

export default async function EstimatorHomePage() {
  const role = await getAppRole();
  if (role === "operator") {
    redirect("/operator");
  }

  const labels = getWorkspaceLabels("estimator");
  const [projects, catalog] = await Promise.all([getProjects(), getCatalogDefaults()]);
  const rows = serializeProjectListRows(projects);

  const totalPanels = projects.reduce((sum, project) => sum + project.panels.length, 0);
  const totalParts = rows.reduce((sum, row) => sum + row.partsQuantity, 0);

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: labels.section },
          ]}
          actions={
            <NewCalculationSheet
              labels={labels}
              materials={catalog.materials}
              sheetFormats={catalog.sheetFormats}
              machineProfiles={catalog.machineProfiles}
            />
          }
        />
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Расчётов</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {projects.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Панелей</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {totalPanels}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Деталей</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {totalParts}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="mx-4 gap-0 overflow-hidden py-0 lg:mx-6">
              <CardHeader className="border-b px-6 py-6">
                <CardTitle>{labels.tableTitle}</CardTitle>
                <CardDescription>{labels.tableDescription}</CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <EstimatorCalculationsTable
                  rows={rows}
                  emptyMessage={labels.emptyList}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
