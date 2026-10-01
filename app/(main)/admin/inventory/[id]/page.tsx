import { notFound } from "next/navigation";
import { ItemDetail } from "@/components/admin/item-detail";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTime, formatDelta, personName, restrictionText } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store } = await requireAdmin();
  const item = store.items.find((entry) => entry.id === id);
  if (!item) notFound();
  const ledger = store.ledger
    .filter((entry) => entry.itemId === item.id)
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      text: `${personName(store, entry.actorId)} · ${entry.kind.replaceAll("_", " ")} ${formatDelta(entry.delta)}`,
      when: formatDateTime(entry.at),
    }));

  return (
    <>
      <PageHeader title={item.name} body={item.description || item.category} />
      <ItemDetail
        item={item}
        items={store.items}
        groups={store.groups.map((group) => ({ id: group.id, name: group.name }))}
        restriction={restrictionText(item, store.groups)}
        ledger={ledger}
      />
    </>
  );
}
