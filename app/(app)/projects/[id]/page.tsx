import { notFound } from "next/navigation";

import { AppPage } from "@/components/app-page";
import { EstimatorWorkspace } from "@/components/projects/estimator-workspace";
import { SiteHeader } from "@/components/site-header";
import { getProjectById } from "@/features/projects/queries";
import { requireAppRole } from "@/lib/auth/session";
import { isEntityId } from "@/lib/id";
import { serializePanelsForClient, serializeSheetContext } from "@/features/projects/serialize-panels";
import { getWorkspaceLabels } from "@/lib/auth/workspace-labels";

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

  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <AppPage
      fill
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: labels.section, href: "/" },
            { label: project.name },
          ]}
        />
      }
    >
      <EstimatorWorkspace
        projectId={project.id}
        projectName={project.name}
        contractNumber={project.contractNumber}
        panels={serializePanelsForClient(project.panels)}
        sheetContext={serializeSheetContext(project)}
        initialSheetParam={query.sheet ?? null}
      />
    </AppPage>
  );
}
