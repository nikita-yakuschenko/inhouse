import Link from "next/link";
import { redirect } from "next/navigation";

import { AppPage } from "@/components/app-page";
import { SiteHeader } from "@/components/site-header";
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
import { getOperatorAssignments } from "@/features/projects/queries";
import { getAppRole } from "@/lib/auth/session";
import { getWorkspaceLabels } from "@/lib/auth/workspace-labels";

export const dynamic = "force-dynamic";

export default async function OperatorAssignmentsPage() {
  const role = await getAppRole();
  if (role !== "operator") {
    redirect("/");
  }

  const assignments = await getOperatorAssignments();

  const labels = getWorkspaceLabels("operator");

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/operator" },
            { label: labels.section },
          ]}
        />
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <Card>
                <CardHeader>
                  <CardTitle>{labels.tableTitle}</CardTitle>
                  <CardDescription>{labels.tableDescription}</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Проект</TableHead>
                        <TableHead>Панель</TableHead>
                        <TableHead>Детали</TableHead>
                        <TableHead>Листов</TableHead>
                        <TableHead className="pr-6 text-right">Действие</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-10 text-center text-muted-foreground"
                          >
                            Нет готовых заданий. Сметчик должен выполнить расчёт раскроя.
                          </TableCell>
                        </TableRow>
                      ) : (
                        assignments.map((assignment) => (
                          <TableRow key={`${assignment.projectId}-${assignment.panelId}`}>
                            <TableCell className="pl-6 font-medium">
                              {assignment.projectName}
                            </TableCell>
                            <TableCell>{assignment.panelName}</TableCell>
                            <TableCell>
                              {assignment.partsCount} поз. · {assignment.partsQuantity} шт.
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{assignment.sheetsCount}</Badge>
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <Link
                                href={`/operator/projects/${assignment.projectId}?panel=${assignment.panelId}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                Открыть
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
