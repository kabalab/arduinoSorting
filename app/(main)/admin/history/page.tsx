import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, historyEvents } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const queryValue = params.q;
  const rawQuery = Array.isArray(queryValue) ? queryValue[0] ?? "" : queryValue ?? "";
  const query = rawQuery.trim().toLowerCase();
  const { store } = await requireAdmin();
  const events = historyEvents(store).filter((event) => {
    if (!query) return true;
    return `${event.title} ${event.detail}`.toLowerCase().includes(query);
  });

  return (
    <>
      <PageHeader title="History" body="Request decisions and stock ledger lines. Removing a supply does not erase its ledger." />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-64 flex-1 space-y-1.5 text-sm">
          <span className="font-medium">Search</span>
          <input name="q" defaultValue={rawQuery} className="w-full rounded-lg border border-stroke bg-background px-3 py-2" placeholder="Person, supply, or status" />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {historyEvents(store).length === 0 ? (
        <EmptyState title="No history yet" body="Stock changes and requests will be listed here." />
      ) : events.length === 0 ? (
        <EmptyState title="No matching history" body="Try a person, supply name, or status word." />
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
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
