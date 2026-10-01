import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { displayStatus, formatDate, itemLabel, lineOutstanding, overdueLabel } from "@/src/domain";
import { loadContext } from "@/src/server/context";

export default async function CheckedOutPage() {
  const { user, store } = await loadContext();
  const now = new Date();
  const open = store.requests.filter((request) => request.requesterId === user.id && request.status === "checked_out");

  return (
    <>
      <PageHeader title="Checked out" body="Supplies you still have, including anything past its expected return date." />
      {open.length === 0 ? (
        <EmptyState title="Nothing checked out" body="When a request is approved, or your group checks out automatically, the items appear here until they are returned." />
      ) : (
        <div className="space-y-3">
          {open.map((request) => {
            const overdue = overdueLabel(request, now);
            return (
              <Card key={request.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={displayStatus(request, now)} />
                  {overdue ? <span className="text-sm text-danger">{overdue}</span> : null}
                </div>
                <ul className="text-sm">
                  {request.lines.map((line) => (
                    <li key={line.itemId}>
                      {itemLabel(store, line.itemId)} · {lineOutstanding(line)} still out
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted">Expected return {formatDate(request.expectedReturn)}</p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
