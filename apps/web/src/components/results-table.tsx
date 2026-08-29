import type { ColumnMeta, QueryRow } from '@saptalk/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Renders whatever the query returned.
 *
 * Columns come from the response, which derives them from the field registry,
 * so a new entity is renderable without this file changing. There is no column
 * list here on purpose -- one would put the per-entity assumption straight back.
 */

/**
 * Codes that mean nothing to a reader.
 *
 * Keyed by field name rather than entity: a code means the same thing wherever
 * it appears, and the table does not know which entity it is showing.
 */
const CODE_LABELS: Record<string, Record<string, string>> = {
  BusinessPartnerCategory: { '1': 'Person', '2': 'Organisation', '3': 'Group' },
};

/** Values that read better right-aligned or in mono. */
function isMono(column: ColumnMeta): boolean {
  return column.type === 'date' || /ID$|^BusinessPartner$|Code$|Grouping$|User$/.test(column.name);
}

function render(column: ColumnMeta, value: string | null): string {
  if (value === null || value === '') return '—';
  const labels = CODE_LABELS[column.name];
  if (labels?.[value]) return labels[value];
  if (column.type === 'date') return value.slice(0, 10);
  return value;
}

export function ResultsTable({
  columns,
  rows,
}: {
  columns: ColumnMeta[];
  rows: QueryRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-foreground">No records matched.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The query ran successfully — SAP simply holds nothing that fits it.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.name}
                className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell
                  key={column.name}
                  className={
                    isMono(column)
                      ? 'tabular whitespace-nowrap font-mono text-[12.5px] text-muted-foreground'
                      : 'whitespace-nowrap text-[13px] text-foreground'
                  }
                >
                  {render(column, row[column.name] ?? null)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
