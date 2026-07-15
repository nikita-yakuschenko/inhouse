"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";

import { importPartsFromXlsxAction } from "@/features/parts/actions";
import { Button } from "@/components/ui/button";

export function ImportPartsButton({
  projectId,
  panelId,
}: {
  projectId: string;
  panelId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    inputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("panelId", panelId);
    formData.set("file", file);

    startTransition(async () => {
      const result = await importPartsFromXlsxAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Загружено деталей: ${result.importedCount}`, {
        description: file.name,
      });
      router.refresh();
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={handleClick}
      >
        <IconUpload className="size-4" />
        {pending ? "Загрузка…" : "Загрузить из Excel"}
      </Button>
    </>
  );
}
