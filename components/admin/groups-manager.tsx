"use client";

import { useActionState } from "react";
import { saveGroup } from "@/src/actions/admin";
import type { ActionResult } from "@/src/actions/result";
import type { ApprovalMode } from "@/src/domain/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export type GroupCard = { id: string; name: string; approvalMode: ApprovalMode };

const modes: { value: ApprovalMode; label: string; detail: string }[] = [
  {
    value: "automatic",
    label: "Automatic",
    detail: "Requests from this group check out immediately when the supplies are available.",
  },
  {
    value: "required",
    label: "Approval required",
    detail: "Requests from this group stay pending until an administrator approves them.",
  },
];

export function GroupsManager({ groups }: { groups: GroupCard[] }) {
  return (
    <div className="space-y-4">
      <GroupForm />
      {groups.length === 0 ? (
        <EmptyState title="Add the first group" body="Create a group and choose whether its requests need approval." />
      ) : (
        groups.map((group) => <GroupForm key={`${group.id}-${group.name}-${group.approvalMode}`} group={group} />)
      )}
    </div>
  );
}

function GroupForm({ group }: { group?: GroupCard }) {
  const toast = useToast();
  const [state, action, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await saveGroup(null, formData);
    toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    return result;
  }, null);

  return (
    <Card>
      <form action={action} className="space-y-3">
        {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
        <Input label={group ? "Group name" : "New group name"} name="name" defaultValue={group?.name ?? ""} required />
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Approval mode</legend>
          {modes.map((mode) => (
            <label key={mode.value} className="block rounded-lg border border-stroke px-3 py-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="approvalMode" value={mode.value} defaultChecked={(group?.approvalMode ?? "required") === mode.value} />
                {mode.label}
              </span>
              <span className="mt-1 block text-muted">{mode.detail}</span>
            </label>
          ))}
        </fieldset>
        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : group ? "Save group" : "Create group"}
        </Button>
      </form>
    </Card>
  );
}
