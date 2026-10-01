"use client";

import { useActionState, useState } from "react";
import { rotateAccessCode, savePerson } from "@/src/actions/admin";
import type { CodeResult } from "@/src/actions/result";
import type { Role } from "@/src/domain/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePendingAction } from "@/components/ui/use-pending";

type GroupOption = { id: string; name: string };
export type PersonCard = { id: string; displayName: string; role: Role; groupId: string };

export function UsersManager({ people, groups }: { people: PersonCard[]; groups: GroupOption[] }) {
  const [revealed, setRevealed] = useState<{ person: string; accessCode: string; message: string } | null>(null);

  return (
    <div className="space-y-4">
      <PersonForm groups={groups} onCode={setRevealed} />
      {people.length === 0 ? (
        <EmptyState title="No people yet" body="Create a person, assign a group and role, and share the access code once." />
      ) : (
        people.map((person) => (
          <PersonForm key={`${person.id}-${person.displayName}-${person.role}-${person.groupId}`} person={person} groups={groups} onCode={setRevealed} />
        ))
      )}
      <Dialog open={Boolean(revealed)} title="Access code" onClose={() => setRevealed(null)}>
        {revealed ? (
          <div className="space-y-3 text-sm">
            <p>{revealed.message}</p>
            <p>
              {revealed.person}: <span className="font-mono text-base text-text">{revealed.accessCode}</span>
            </p>
            <p className="text-muted">This code is shown once. After you close this dialog, only a hash is stored.</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function PersonForm({
  person,
  groups,
  onCode,
}: {
  person?: PersonCard;
  groups: GroupOption[];
  onCode: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  const toast = useToast();
  const { pending: rotating, run } = usePendingAction();
  const [state, action, pending] = useActionState(async (_previous: CodeResult | null, formData: FormData) => {
    const result = await savePerson(null, formData);
    if (result.ok && result.accessCode) onCode({ person: result.person, accessCode: result.accessCode, message: result.message });
    else toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    return result;
  }, null);

  return (
    <Card>
      <form action={action} className="grid gap-3 md:grid-cols-2">
        {person ? <input type="hidden" name="userId" value={person.id} /> : null}
        <Input label={person ? "Name" : "New person"} name="displayName" defaultValue={person?.displayName ?? ""} required />
        <Select label="Group" name="groupId" defaultValue={person?.groupId ?? groups[0]?.id ?? ""} required>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <Select label="Role" name="role" defaultValue={person?.role ?? "member"}>
          <option value="member">Member</option>
          <option value="admin">Administrator</option>
        </Select>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={pending || groups.length === 0}>
            {pending ? "Saving…" : person ? "Save person" : "Create person"}
          </Button>
          {person ? (
            <Button
              variant="secondary"
              disabled={rotating}
              onClick={() =>
                run(async () => {
                  const result = await rotateAccessCode(person.id);
                  if (result.ok && result.accessCode) onCode({ person: result.person, accessCode: result.accessCode, message: result.message });
                  return result.ok ? { ok: true, message: "Access code ready." } : result;
                })
              }
            >
              {rotating ? "Rotating…" : "Rotate access code"}
            </Button>
          ) : null}
        </div>
        {state && !state.ok ? <p className="text-sm text-danger md:col-span-2">{state.error}</p> : null}
      </form>
    </Card>
  );
}
