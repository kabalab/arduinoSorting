import { AdminCheckoutForm } from "@/components/admin/admin-checkout-form";
import { ReturnPanel } from "@/components/requests/request-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { displayStatus, formatDate, groupName, itemLabel, lineOutstanding, overdueLabel, personName } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

export default async function AdminCheckedOutPage() {
  const { store } = await requireAdmin();
  const now = new Date();
  const open = store.requests
    .filter((request) => request.status === "checked_out")
    .sort((left, right) => left.expectedReturn.localeCompare(right.expectedReturn));

  return (
    <>
      <PageHeader
        title="Checked out"
        body="Open loans and overdue items. Check items out to any group immediately, or record a full return or only the quantities that came back."
      />
      <div className="space-y-4">
        <AdminCheckoutForm
          groups={store.groups.map((group) => ({ id: group.id, name: group.name }))}
          items={[...store.items]
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((item) => ({ id: item.id, name: item.name, available: item.available }))}
        />
        {open.length === 0 ? (
          <EmptyState title="Nothing is checked out" body="Approved requests, automatic checkouts, and checkouts you make for a group show up here until every item is returned." />
        ) : (
          <div className="space-y-3">
            {open.map((request) => {
              const overdue = overdueLabel(request, now);
              return (
                <Card key={request.id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={displayStatus(request, now)} />
                    {overdue ? <span className="text-sm text-danger">{overdue}</span> : null}
                  </div>
                  <p className="text-sm">
                    {personName(store, request.requesterId)} · {groupName(store, request.groupId)} · Expected return {formatDate(request.expectedReturn)}
                  </p>
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
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
