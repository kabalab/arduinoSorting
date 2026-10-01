import { GroupsManager, type AccessCodeCard } from "@/components/admin/groups-manager";
import { PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/src/server/context";

export default async function GroupsPage() {
  const { store } = await requireAdmin();
  const groups = store.groups.map((group) => ({
    id: group.id,
    name: group.name,
    approvalMode: group.approvalMode,
    grantsAdmin: group.grantsAdmin,
    membersCanReturn: group.membersCanReturn,
    codes: store.credentials.flatMap((credential) => {
      const person = store.users.find((user) => user.id === credential.userId);
      if (!person || person.groupId !== group.id) return [];
      const code: AccessCodeCard = {
        userId: person.id,
        displayName: person.displayName,
        viewable: Boolean(credential.code),
      };
      return [code];
    }),
  }));

  return (
    <>
      <PageHeader
        title="Groups"
        body="Each group has an approval mode, a return setting, and the access codes for its people. Codes in Administrators sign in with full access."
      />
      <GroupsManager groups={groups} />
    </>
  );
}
