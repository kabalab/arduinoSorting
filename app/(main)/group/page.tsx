import { PeopleCodes, type AccessCodeCard } from "@/components/admin/groups-manager";
import { ApproveButton, DenyButton } from "@/components/requests/request-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, groupName, itemLabel, personName } from "@/src/domain";
import { requireGroupAdmin } from "@/src/server/context";

export default async function GroupPage() {
  const { user, store } = await requireGroupAdmin();
  const people = store.credentials.flatMap((credential) => {
    const person = store.users.find((entry) => entry.id === credential.userId);
    if (!person || person.groupId !== user.groupId) return [];
    return [person];
  });
  const pending = store.requests
    .filter((request) => request.status === "pending" && request.groupId === user.groupId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <>
      <PageHeader
        title={groupName(store, user.groupId)}
        body="Add people, and see, rename, or rotate codes in this group, including your own. Settings for someone else stay within the permissions you have. Approve or deny this group's pending requests."
      />
      <div className="space-y-6">
        <Card>
        <PeopleCodes
          groupId={user.groupId}
          groupName={groupName(store, user.groupId)}
          grantsAdmin={false}
          viewer={{
            id: user.id,
            siteAdmin: false,
            primary: false,
            approvalMode: user.approvalMode,
            canReturn: user.canReturn,
          }}
          codes={people.map((person): AccessCodeCard => {
            const credential = store.credentials.find((entry) => entry.userId === person.id);
            return {
              userId: person.id,
              displayName: person.displayName,
              viewable: Boolean(credential?.code),
              approvalMode: person.approvalMode,
              canReturn: person.canReturn,
              groupAdmin: person.groupAdmin,
              primaryAdmin: false,
            };
          })}
        />
        </Card>
        <section className="space-y-3">
          <h2 className="font-medium">Pending requests</h2>
          {pending.length === 0 ? (
            <EmptyState title="No pending requests" body="Requests from people who need approval show up here." />
          ) : (
            pending.map((request) => (
              <Card key={request.id} className="space-y-3">
                <p className="text-sm">{personName(store, request.requesterId)}</p>
                <ul className="text-sm">
                  {request.lines.map((line) => (
                    <li key={line.itemId}>
                      {itemLabel(store, line.itemId)} × {line.quantityRequested}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted">Expected return {formatDate(request.expectedReturn)}</p>
                <div className="flex flex-wrap gap-2">
                  <ApproveButton requestId={request.id} />
                  <DenyButton requestId={request.id} />
                </div>
              </Card>
            ))
          )}
        </section>
      </div>
    </>
  );
}
