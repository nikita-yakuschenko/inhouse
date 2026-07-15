"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  IconArrowsUpDown,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from "@tabler/icons-react";

import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { EditProjectButton } from "@/components/projects/edit-project-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatProjectUpdatedAt,
  type ProjectListRow,
} from "@/features/projects/serialize-project-list";
import { PROJECT_STATUS_LABELS } from "@/lib/auth/workspace-labels";

function SortableHeader({
  column,
  children,
}: {
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <IconArrowsUpDown className="ml-2 size-3.5 opacity-60" />
    </Button>
  );
}

export function EstimatorCalculationsTable({
  rows,
  emptyMessage,
}: {
  rows: ProjectListRow[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");

  function openProject(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, projectId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject(projectId);
    }
  }

  const columns = useMemo<ColumnDef<ProjectListRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>Зав. № домокомплекта</SortableHeader>
        ),
        cell: ({ row }) => {
          const kindLabel = row.original.kind === "bar" ? "Погонаж" : "Плиты";
          const technologyLabel =
            row.original.technology === "pkd"
              ? "ПКД"
              : row.original.technology === "md"
                ? "МД"
                : null;
          const title = technologyLabel
            ? `${row.original.name} · ${technologyLabel}`
            : row.original.name;

          return (
            <div className="min-w-48">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{title}</p>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {kindLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.original.contractNumber
                  ? `договор ${row.original.contractNumber}`
                  : row.original.id}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "panelsCount",
        header: ({ column }) => (
          <SortableHeader column={column}>Панели / заг.</SortableHeader>
        ),
        cell: ({ row }) => <span className="tabular-nums">{row.original.panelsCount}</span>,
      },
      {
        accessorKey: "partsQuantity",
        header: ({ column }) => <SortableHeader column={column}>Детали</SortableHeader>,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.partsCount} поз. · {row.original.partsQuantity} шт.
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Статус",
        cell: ({ row }) => (
          <Badge variant="outline">
            {PROJECT_STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => <SortableHeader column={column}>Обновлён</SortableHeader>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatProjectUpdatedAt(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Действия</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-0.5">
            <EditProjectButton
              projectId={row.original.id}
              factoryNumber={row.original.name}
              contractNumber={row.original.contractNumber}
              technology={row.original.technology}
            />
            <DeleteProjectButton
              projectId={row.original.id}
              projectName={row.original.name}
            />
          </div>
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Поиск по проекту..."
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {table.getFilteredRowModel().rows.length} из {rows.length}
        </p>
      </div>

      <div className="overflow-hidden border-y">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => (
                  <TableHead
                    key={header.id}
                    className={index === 0 ? "pl-6" : index === headerGroup.headers.length - 1 ? "pr-6" : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 px-6 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  role="link"
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => openProject(row.original.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, row.original.id)}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={
                        index === 0
                          ? "pl-6"
                          : index === row.getVisibleCells().length - 1
                            ? "pr-6"
                            : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-6">
        <p className="text-sm text-muted-foreground">
          Стр. {table.getState().pagination.pageIndex + 1} из {table.getPageCount() || 1}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
