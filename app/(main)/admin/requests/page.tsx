import type { ReactNode } from "react";
import { ApproveButton, DenyButton } from "@/components/requests/request-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { displayStatus, formatDate, groupName, itemLabel, matchesStatusFilter, overdueLabel, personName, STATUS_LABEL, type DisplayStatus } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

const statuses: Array<DisplayStatus | "all"> = ["all", "pending", "approved", "checked_out", "returned", "overdue", "denied", "cancelled"];

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selected = {
    group: first(params.group),
    status: first(params.status) || "all",
    person: first(params.person),
    item: first(params.item).trim().toLowerCase(),
    date: first(params.date),
  };
  const { store } = await requireAdmin();
  const now = new Date();
  const requests = store.requests
    .filter((request) => (selected.group ? request.groupId === selected.group : true))
    .filter((request) => (selected.person ? request.requesterId === selected.person : true))
    .filter((request) => (selected.date ? request.expectedReturn === selected.date : true))
    .filter((request) => matchesStatusFilter(request, selected.status, now))
    .filter((request) => {
      if (!selected.item) return true;
      return request.lines.some((line) => itemLabel(store, line.itemId).toLowerCase().includes(selected.item));
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <>
      <PageHeader title="Requests" body="Approve a pending request to check the items out immediately. Deny can include a reason." />
      <form className="mb-4 grid gap-3 rounded-xl border border-stroke bg-card p-4 md:grid-cols-3">
        <Filter label="Group" name="group" defaultValue={selected.group}>
          <option value="">All groups</option>
          {store.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Filter>
        <Filter label="Status" name="status" defaultValue={selected.status}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : STATUS_LABEL[status]}
            </option>
          ))}
        </Filter>
        <Filter label="Person" name="person" defaultValue={selected.person}>
          <option value="">Everyone</option>
          {store.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </Filter>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Item</span>
          <input name="item" defaultValue={first(params.item)} className="w-full rounded-lg border border-stroke bg-background px-3 py-2" placeholder="Supply name" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Expected return date</span>
          <input name="date" type="date" defaultValue={selected.date} className="w-full rounded-lg border border-stroke bg-background px-3 py-2" />
        </label>
        <div className="flex items-end">
          <Button type="submit">Apply filters</Button>
        </div>
      </form>
      {store.requests.length === 0 ? (
        <EmptyState title="No requests yet" body="Requests appear here after someone submits one." />
      ) : requests.length === 0 ? (
        <EmptyState title="No requests match" body="Clear a filter or choose a different status, group, person, item, or date." />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const overdue = overdueLabel(request, now);
            return (
              <Card key={request.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={displayStatus(request, now)} />
                  {overdue ? <span className="text-sm text-danger">{overdue}</span> : null}
                  {request.approvedAt ? <span className="text-xs text-muted">Approved {formatDate(request.approvedAt.slice(0, 10))}</span> : null}
                </div>
                <p className="text-sm">
                  {personName(store, request.requesterId)} · {groupName(store, request.groupId)}
                </p>
                <ul className="text-sm">
                  {request.lines.map((line) => (
                    <li key={line.itemId}>
                      {itemLabel(store, line.itemId)} × {line.quantityRequested}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted">Expected return {formatDate(request.expectedReturn)}</p>
                {request.denialReason ? <p className="text-sm">Denied: {request.denialReason}</p> : null}
                {request.status === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <ApproveButton requestId={request.id} />
                    <DenyButton requestId={request.id} />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function Filter({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue} className="w-full rounded-lg border border-stroke bg-background px-3 py-2">
        {children}
      </select>
    </label>
  );
}
