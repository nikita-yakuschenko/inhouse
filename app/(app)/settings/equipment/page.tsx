import { AppPage } from "@/components/app-page";
import { CreateMachineButton } from "@/components/settings/create-machine-button";
import { DeleteMachineButton } from "@/components/settings/delete-machine-button";
import { EditMachineButton } from "@/components/settings/edit-machine-button";
import { SiteHeader } from "@/components/site-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMachineProfilesForSettings } from "@/features/machines/queries";
import { requireAppRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function formatKerfLabel(value: { toString(): string } | number | string): string {
  const raw =
    typeof value === "object" && value !== null && "toString" in value
      ? value.toString()
      : String(value);
  return raw.replace(".", ",");
}

export default async function EquipmentSettingsPage() {
  await requireAppRole("estimator");
  const machines = await getMachineProfilesForSettings();

  const rows = machines.map((machine) => ({
    id: machine.id,
    name: machine.name,
    isDefault: machine.isDefault,
    kerfLabel: formatKerfLabel(machine.defaultKerfMm),
  }));

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: "Настройки", href: "/settings" },
            { label: "Оборудование" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Оборудование</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Станки для раскроя: название и ширина пропила.
            </p>
          </div>
          <CreateMachineButton />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Оборудования пока нет
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Название</TableHead>
                  <TableHead className="text-right">Пропил, мм</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="pl-6 font-medium">
                      {machine.name}
                      {machine.isDefault ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          по умолчанию
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {machine.kerfLabel}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <EditMachineButton
                          machineId={machine.id}
                          machineName={machine.name}
                          kerfLabel={machine.kerfLabel}
                        />
                        <DeleteMachineButton
                          machineId={machine.id}
                          machineName={machine.name}
                        />
                      </div>
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
