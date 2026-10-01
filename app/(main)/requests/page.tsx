import { CancelRequestButton } from "@/components/requests/request-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { displayStatus, formatDate, formatDateTime, itemLabel, overdueLabel } from "@/src/domain";
import { loadContext } from "@/src/server/context";

export default async function MyRequestsPage() {
  const { user, store } = await loadContext();
  const now = new Date();
  const requests = store.requests
    .filter((request) => request.requesterId === user.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <>
      <PageHeader title="My requests" body="These are only your requests. Other groups are not listed here." />
      {requests.length === 0 ? (
        <EmptyState title="No requests yet" body="Add supplies to a request cart and submit them. They will show up here." />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const status = displayStatus(request, now);
            const overdue = overdueLabel(request, now);
            return (
              <Card key={request.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge status={status} />
                  {overdue ? <span className="text-sm text-danger">{overdue}</span> : null}
                </div>
                <ul className="space-y-1 text-sm">
                  {request.lines.map((line) => (
                    <li key={line.itemId}>
                      {itemLabel(store, line.itemId)} × {line.quantityRequested}
                      {line.quantityCheckedOut > 0 ? ` · ${line.quantityReturned} of ${line.quantityCheckedOut} returned` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted">
                  Submitted {formatDateTime(request.createdAt)} · Expected return {formatDate(request.expectedReturn)}
                </p>
                {request.denialReason ? <p className="text-sm">Denied: {request.denialReason}</p> : null}
                {request.status === "pending" ? <CancelRequestButton requestId={request.id} /> : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
