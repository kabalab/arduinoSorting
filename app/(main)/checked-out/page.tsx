import { ReturnPanel } from "@/components/requests/request-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { canReturnRequest, displayStatus, formatDate, itemLabel, lineOutstanding, memberCanSeeCheckout, overdueLabel, personName } from "@/src/domain";
import { loadContext } from "@/src/server/context";

export default async function CheckedOutPage() {
  const { user, store } = await loadContext();
  const now = new Date();
  const open = store.requests.filter((request) => request.status === "checked_out" && memberCanSeeCheckout(store, user, request));

  return (
    <>
      <PageHeader
        title="Checked out"
        body="Supplies you still have, plus anything an administrator checked out for your group, including anything past its expected return date."
      />
      {open.length === 0 ? (
        <EmptyState
          title="Nothing checked out"
          body="When a request is approved, your group checks out automatically, or an administrator checks items out for your group, the items appear here until they are returned."
        />
      ) : (
        <div className="space-y-3">
          {open.map((request) => {
            const overdue = overdueLabel(request, now);
            const canReturn = canReturnRequest(store, user, request) === null;
            return (
              <Card key={request.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={displayStatus(request, now)} />
                  {overdue ? <span className="text-sm text-danger">{overdue}</span> : null}
                </div>
                {request.requesterId !== user.id ? (
                  <p className="text-sm">Checked out by {personName(store, request.requesterId)} for your group.</p>
                ) : null}
                {canReturn ? null : (
                  <ul className="text-sm">
                    {request.lines.map((line) => (
                      <li key={line.itemId}>
                        {itemLabel(store, line.itemId)} · {lineOutstanding(line)} still out
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-muted">Expected return {formatDate(request.expectedReturn)}</p>
                {canReturn ? (
                  <ReturnPanel
                    key={request.lines.map((line) => `${line.itemId}:${line.quantityReturned}`).join("|")}
                    requestId={request.id}
                    lines={request.lines
                      .filter((line) => lineOutstanding(line) > 0)
                      .map((line) => ({
                        itemId: line.itemId,
                        name: itemLabel(store, line.itemId),
                        outstanding: lineOutstanding(line),
                      }))}
                  />
                ) : (
                  <p className="text-sm text-muted">An administrator records returns for your group.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
