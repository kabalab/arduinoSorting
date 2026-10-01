import { GroupsManager } from "@/components/admin/groups-manager";
import { PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/src/server/context";

export default async function GroupsPage() {
  const { store } = await requireAdmin();
  return (
    <>
      <PageHeader title="Groups" body="Each group is either approved automatically or waits for an administrator." />
      <GroupsManager groups={store.groups.map((group) => ({ id: group.id, name: group.name, approvalMode: group.approvalMode }))} />
    </>
  );
}
