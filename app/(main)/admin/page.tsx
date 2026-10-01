import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, historyEvents, isOverdue } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

export default async function AdminDashboardPage() {
  const { store } = await requireAdmin();
  const now = new Date();
  const pending = store.requests.filter((request) => request.status === "pending").length;
  const overdue = store.requests.filter((request) => isOverdue(request, now)).length;
  const checkedOut = store.requests.filter((request) => request.status === "checked_out" && !isOverdue(request, now)).length;
  const recent = historyEvents(store).slice(0, 6);

  return (
    <>
      <PageHeader title="Dashboard" body="Open work across every group." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Count label="Pending" value={pending} href="/admin/requests?status=pending" />
        <Count label="Checked out" value={checkedOut} href="/admin/checked-out" />
        <Count label="Overdue" value={overdue} href="/admin/checked-out" />
      </div>
      <h2 className="mt-8 mb-3 text-lg font-medium">Recent activity</h2>
      {recent.length === 0 ? (
        <EmptyState title="No activity yet" body="Add a supply or a group to start the ledger." />
      ) : (
        <div className="space-y-2">
          {recent.map((event) => (
            <Card key={event.id}>
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-muted">{event.detail}</p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(event.at)}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Count({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-stroke bg-card p-4 hover:border-accent">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Link>
  );
}
