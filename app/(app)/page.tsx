import Link from "next/link";
import { redirect } from "next/navigation";

import { AppPage } from "@/components/app-page";
import { SiteHeader } from "@/components/site-header";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCatalogDefaults, getProjects } from "@/features/projects/queries";
import { getAppRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const role = await getAppRole();
  if (role === "operator") {
    redirect("/operator");
  }

  const [projects, catalog] = await Promise.all([getProjects(), getCatalogDefaults()]);

  const totalPanels = projects.reduce((sum, project) => sum + project.panels.length, 0);
  const calculatedPanels = projects.reduce(
    (sum, project) =>
      sum +
      project.panels.filter((panel) => panel.cutPlans.length > 0).length,
    0,
  );

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: "Проекты" },
          ]}
        />
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Проектов</CardDescription>
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
                  <CardDescription>С расчётом</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {calculatedPanels}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 px-4 lg:px-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Список проектов</CardTitle>
                  <CardDescription>
                    Расчёт раскроя и подготовка производственных карт
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Проект</TableHead>
                        <TableHead>Панели</TableHead>
                        <TableHead>Детали</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="pr-6 text-right">Расчёт</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            Проектов пока нет. Создайте первый проект справа.
                          </TableCell>
                        </TableRow>
                      ) : (
                        projects.map((project) => {
                          const partsCount = project.panels.reduce(
                            (sum, panel) => sum + panel.parts.length,
                            0,
                          );
                          const calculatedCount = project.panels.filter(
                            (panel) => panel.cutPlans.length > 0,
                          ).length;

                          return (
                          <TableRow key={project.id}>
                            <TableCell className="pl-6 font-medium">
                              <Link
                                href={`/projects/${project.id}`}
                                className="hover:underline"
                              >
                                {project.name}
                              </Link>
                            </TableCell>
                            <TableCell>{project.panels.length}</TableCell>
                            <TableCell>{partsCount}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{project.status}</Badge>
                            </TableCell>
                            <TableCell className="pr-6 text-right text-muted-foreground">
                              {calculatedCount > 0
                                ? `${calculatedCount} пан. с расчётом`
                                : "без расчёта"}
                            </TableCell>
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Новый проект</CardTitle>
                  <CardDescription>
                    Укажите материал, формат листа и профиль станка
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreateProjectForm
                    materials={catalog.materials}
                    sheetFormats={catalog.sheetFormats}
                    machineProfiles={catalog.machineProfiles}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
