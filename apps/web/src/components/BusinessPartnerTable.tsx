import type { BusinessPartner } from '@saptalk/shared';

const COLUMNS: { key: keyof BusinessPartner; label: string }[] = [
  { key: 'businessPartner', label: 'ID' },
  { key: 'businessPartnerFullName', label: 'Name' },
  { key: 'businessPartnerCategory', label: 'Category' },
  { key: 'businessPartnerGrouping', label: 'Grouping' },
  { key: 'createdByUser', label: 'Created by' },
  { key: 'createdOn', label: 'Created on' },
];

export function BusinessPartnerTable({ rows }: { rows: BusinessPartner[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No records returned.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-black/[0.02] text-left">
            {COLUMNS.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium text-muted">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.businessPartner} className="border-b border-line last:border-0">
              {COLUMNS.map((column) => (
                <td key={column.key} className="px-3 py-2 whitespace-nowrap">
                  {format(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function format(value: string | null): string {
  if (!value) return '—';
  // ISO timestamps are only meaningful to the day for SAP creation dates.
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
}
