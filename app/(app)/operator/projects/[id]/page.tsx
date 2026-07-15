import { notFound } from "next/navigation";

import { AppPage } from "@/components/app-page";
import { PanelWorkspace } from "@/components/projects/panel-workspace";
import { SiteHeader } from "@/components/site-header";
import { getProjectById } from "@/features/projects/queries";
import { requireAppRole } from "@/lib/auth/session";
import { isEntityId } from "@/lib/id";
import { serializePanelsForClient, serializeSheetContext } from "@/features/projects/serialize-panels";

export const dynamic = "force-dynamic";

export default async function OperatorProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ panel?: string; sheet?: string }>;
}) {
  await requireAppRole("operator");

  const { id } = await params;
  const query = await searchParams;

  if (!isEntityId(id)) {
    notFound();
  }

  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  if (project.kind === "bar") {
    notFound();
  }

  return (
    <AppPage
      fill
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/operator" },
            { label: "Задания", href: "/operator" },
            { label: project.name },
          ]}
        />
      }
    >
      <PanelWorkspace
        projectId={project.id}
        panels={serializePanelsForClient(project.panels)}
        sheetContext={serializeSheetContext(project)}
        initialSheetParam={query.sheet ?? null}
      />
    </AppPage>
  );
}
