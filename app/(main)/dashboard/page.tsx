import { PageHeader } from "@/components/shell/page-header";
import { SupplyBrowser } from "@/components/member/supply-browser";
import { visibleItems } from "@/src/domain";
import { loadContext } from "@/src/server/context";

export default async function DashboardPage() {
  const { user, store } = await loadContext();
  const supplies = visibleItems(store.items, user.groupId).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    available: item.available,
    imageUrl: item.imageUrl,
  }));

  return (
    <>
      <PageHeader title="Supplies" body="Choose what you need and add it to a request. You only see supplies your group is allowed to request." />
      <SupplyBrowser supplies={supplies} />
    </>
  );
}
