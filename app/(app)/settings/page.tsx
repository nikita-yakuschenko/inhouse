import Link from "next/link";

import { AppPage } from "@/components/app-page";
import { SiteHeader } from "@/components/site-header";
import { requireAppRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAppRole("estimator");

  return (
    <AppPage
      header={
        <SiteHeader
          breadcrumbs={[
            { label: "Smartcut", href: "/" },
            { label: "Настройки" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold">Настройки</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Параметры организации и оборудование.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/settings/equipment"
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40"
          >
            <p className="font-medium">Оборудование</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Станки и ширина пропила
            </p>
          </Link>
        </div>
      </div>
    </AppPage>
  );
}
