import { InventoryBrowser } from "@/components/admin/inventory-browser";
import { PageHeader } from "@/components/shell/page-header";
import { itemTotal, restrictionText } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

export default async function InventoryPage() {
  const { store } = await requireAdmin();
  const rows = store.items
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      available: item.available,
      checkedOut: item.checkedOut,
      total: itemTotal(item),
      restriction: restrictionText(item, store.groups),
    }));

  return (
    <>
      <PageHeader title="Inventory" body="Shared catalog. An empty restriction list means every group can request the supply." />
      <InventoryBrowser rows={rows} groups={store.groups.map((group) => ({ id: group.id, name: group.name }))} />
    </>
  );
}
