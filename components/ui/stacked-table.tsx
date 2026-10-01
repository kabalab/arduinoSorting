import type { ReactNode } from "react";

export function StackedTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: { key: string; cells: Record<string, ReactNode> }[];
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-stroke md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-card-muted text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-stroke bg-card">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 align-top">
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.key} className="space-y-2 rounded-xl border border-stroke bg-card p-4">
            {columns.map((column) => (
              <div key={column.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-muted">{column.label}</span>
                <span className="text-right">{row.cells[column.key]}</span>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
