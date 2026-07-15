import Link from "next/link";

import { AppPage } from "@/components/app-page";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireAppRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function MachinesCatalogPage() {
  await requireAppRole("estimator");
  const machines = await prisma.machineProfile.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: "Справочники", href: "/catalog" },
            { label: "Профили станков" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold">Профили станков</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Пока доступен просмотр. Добавление станков — в следующей итерации.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {machines.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">Профилей станков пока нет</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/">К расчётам</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {machines.map((machine) => (
                <li key={machine.id} className="px-6 py-4">
                  <p className="font-medium">{machine.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    Пропил {machine.defaultKerfMm} мм · макс. лист{" "}
                    {machine.maxSheetWidthMm}×{machine.maxSheetHeightMm}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppPage>
  );
}
