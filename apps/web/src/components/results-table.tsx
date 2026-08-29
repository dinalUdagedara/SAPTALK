import type { BusinessPartner } from '@saptalk/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COLUMNS = [
  { key: 'businessPartner', label: 'ID', mono: true },
  { key: 'businessPartnerFullName', label: 'Name', mono: false },
  { key: 'businessPartnerCategory', label: 'Category', mono: false },
  { key: 'businessPartnerGrouping', label: 'Grouping', mono: true },
  { key: 'createdByUser', label: 'Created by', mono: true },
  { key: 'createdOn', label: 'Created', mono: true },
] as const satisfies readonly { key: keyof BusinessPartner; label: string; mono: boolean }[];

/** Category arrives as a code; nobody reads "2". */
const CATEGORY_LABELS: Record<string, string> = {
  '1': 'Person',
  '2': 'Organisation',
  '3': 'Group',
};

function render(key: keyof BusinessPartner, value: string | null): string {
  if (!value) return '—';
  if (key === 'businessPartnerCategory') return CATEGORY_LABELS[value] ?? value;
  if (key === 'createdOn') return value.slice(0, 10);
  return value;
}

export function ResultsTable({ rows }: { rows: BusinessPartner[] }) {
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
            {COLUMNS.map((column) => (
              <TableHead
                key={column.key}
                className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.businessPartner}-${index}`}>
              {COLUMNS.map((column) => (
                <TableCell
                  key={column.key}
                  className={
                    column.mono
                      ? 'tabular whitespace-nowrap font-mono text-[12.5px] text-muted-foreground'
                      : 'whitespace-nowrap text-[13px] text-foreground'
                  }
                >
                  {render(column.key, row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
