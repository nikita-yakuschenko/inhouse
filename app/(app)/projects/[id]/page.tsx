import { notFound } from "next/navigation";

import { AppPage } from "@/components/app-page";
import { BarWorkspace } from "@/components/bar/bar-workspace";
import { EstimatorWorkspace } from "@/components/projects/estimator-workspace";
import { SiteHeader } from "@/components/site-header";
import { getCatalogDefaults, getProjectById } from "@/features/projects/queries";
import { serializeBarWorkspace } from "@/features/projects/serialize-bar";
import {
  serializePanelsForClient,
  serializeSheetContext,
} from "@/features/projects/serialize-panels";
import { getWorkspaceLabels } from "@/lib/auth/workspace-labels";
import { requireAppRole } from "@/lib/auth/session";
import { isEntityId } from "@/lib/id";

export const dynamic = "force-dynamic";

export default async function EstimatorProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ panel?: string; sheet?: string }>;
}) {
  await requireAppRole("estimator");

  const labels = getWorkspaceLabels("estimator");
  const { id } = await params;
  const query = await searchParams;

  if (!isEntityId(id)) {
    notFound();
  }

  const [project, catalog] = await Promise.all([
    getProjectById(id),
    getCatalogDefaults(),
  ]);
  if (!project) {
    notFound();
  }

  const header = (
    <SiteHeader
      breadcrumbs={[
        { label: "Smartcut", href: "/" },
        { label: labels.section, href: "/" },
        { label: project.name },
      ]}
    />
  );

  if (project.kind === "bar") {
    return (
      <AppPage fill header={header}>
        <BarWorkspace initial={serializeBarWorkspace(project)} />
      </AppPage>
    );
  }

  return (
    <AppPage fill header={header}>
      <EstimatorWorkspace
        projectId={project.id}
        projectName={project.name}
        contractNumber={project.contractNumber}
        panels={serializePanelsForClient(project.panels)}
        sheetContext={serializeSheetContext(project)}
        sheetFormatId={project.sheetFormatId}
        machineProfileId={project.machineProfileId}
        sheetFormats={catalog.sheetFormats}
        machineProfiles={catalog.machineProfiles}
        initialSheetParam={query.sheet ?? null}
      />
    </AppPage>
  );
}
