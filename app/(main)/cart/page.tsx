import { CartView } from "@/components/member/cart-view";
import { PageHeader } from "@/components/shell/page-header";
import { visibleItems } from "@/src/domain";
import { loadContext } from "@/src/server/context";

export default async function CartPage() {
  const { user, store } = await loadContext();
  const group = store.groups.find((entry) => entry.id === user.groupId);
  if (!group) {
    return <PageHeader title="Request cart" body="Your group was not found. Ask an administrator for help." />;
  }

  return (
    <>
      <PageHeader title="Request cart" body="Set quantities and the date you expect to return everything, then submit." />
      <CartView user={user} group={group} items={visibleItems(store.items, user.groupId)} />
    </>
  );
}
