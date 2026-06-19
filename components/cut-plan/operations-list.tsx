import type { CutOperation } from "@/app/generated/prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OperationsList({ operations }: { operations: CutOperation[] }) {
  if (operations.length === 0) {
    return (
      <div className="px-6 py-8 text-sm text-muted-foreground">
        Операции появятся после расчёта.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">№</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead>Ось</TableHead>
          <TableHead className="pr-6">Примечание</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {operations.map((operation) => (
          <TableRow key={operation.id}>
            <TableCell className="pl-6">{operation.sequenceNumber}</TableCell>
            <TableCell>{operation.operationType}</TableCell>
            <TableCell>{operation.axis}</TableCell>
            <TableCell className="pr-6 text-muted-foreground">
              {operation.note ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
