import { logout } from "@/src/actions/auth";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadContext } from "@/src/server/context";

export default async function AccountPage() {
  const { user, store } = await loadContext();
  const group = store.groups.find((entry) => entry.id === user.groupId);
  const approval =
    group?.approvalMode === "automatic"
      ? "Requests check out immediately when the supplies are available."
      : "Requests stay pending until an administrator approves them.";

  return (
    <>
      <PageHeader title="Account" body="This session stays on this browser until you log out or switch accounts." />
      <Card className="max-w-lg space-y-2">
        <p className="text-lg font-medium">{user.displayName}</p>
        <p className="text-sm text-muted">Group: {group?.name ?? "Unknown group"}</p>
        <p className="text-sm text-muted">Role: {user.role === "admin" ? "Administrator" : "Member"}</p>
        {group ? <p className="text-sm text-muted">{approval}</p> : null}
        <div className="flex flex-wrap gap-2 pt-3">
          <form action={logout}>
            <Button type="submit" variant="secondary">
              Log out
            </Button>
          </form>
          <form action={logout}>
            <Button type="submit">Switch account</Button>
          </form>
        </div>
      </Card>
    </>
  );
}
