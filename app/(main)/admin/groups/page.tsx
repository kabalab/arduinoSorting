import { GroupsManager, type AccessCodeCard } from "@/components/admin/groups-manager";
import { PageHeader } from "@/components/shell/page-header";
import { isPrimaryAdmin } from "@/src/domain";
import { requireAdmin } from "@/src/server/context";

export default async function GroupsPage() {
  const { user, store } = await requireAdmin();
  const groups = store.groups.map((group) => ({
    id: group.id,
    name: group.name,
    grantsAdmin: group.grantsAdmin,
    codes: store.credentials.flatMap((credential) => {
      const person = store.users.find((user) => user.id === credential.userId);
      if (!person || person.groupId !== group.id) return [];
      const code: AccessCodeCard = {
        userId: person.id,
        displayName: person.displayName,
        viewable: Boolean(credential.code),
        approvalMode: person.approvalMode,
        canReturn: person.canReturn,
        groupAdmin: person.groupAdmin,
        primaryAdmin: Boolean(person.primaryAdmin),
      };
      return [code];
    }),
  }));

  return (
    <>
      <PageHeader
        title="Groups"
        body="Each person has their own approval mode, return permission, and group admin setting. Open Settings on their code to change them. Administrator codes have no permission settings. Only the original administrator can view or change that code."
      />
      <GroupsManager
        groups={groups}
        viewer={{
          id: user.id,
          siteAdmin: true,
          primary: isPrimaryAdmin(store, user),
          approvalMode: user.approvalMode,
          canReturn: user.canReturn,
        }}
      />
    </>
  );
}
