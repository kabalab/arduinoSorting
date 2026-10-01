import { UsersManager } from "@/components/admin/users-manager";
import { PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/src/server/context";

export default async function UsersPage() {
  const { store } = await requireAdmin();
  return (
    <>
      <PageHeader title="Users / Access" body="Create a person, assign a group and role, and share an access code. The code is shown once." />
      <UsersManager
        people={store.users.map((user) => ({
          id: user.id,
          displayName: user.displayName,
          role: user.role,
          groupId: user.groupId,
        }))}
        groups={store.groups.map((group) => ({ id: group.id, name: group.name }))}
      />
    </>
  );
}
