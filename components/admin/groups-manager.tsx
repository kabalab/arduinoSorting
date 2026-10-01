"use client";

import { useActionState, useState } from "react";
import { addAccessCode, removeAccessCode, renameAccessCode, revealAccessCode, rotateAccessCode, saveGroup } from "@/src/actions/admin";
import type { ActionResult, CodeResult } from "@/src/actions/result";
import type { ApprovalMode } from "@/src/domain/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePendingAction } from "@/components/ui/use-pending";

export type AccessCodeCard = { userId: string; displayName: string; viewable: boolean };

export type GroupCard = {
  id: string;
  name: string;
  approvalMode: ApprovalMode;
  grantsAdmin: boolean;
  membersCanReturn: boolean;
  codes: AccessCodeCard[];
};

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
  const [revealed, setRevealed] = useState<{ person: string; accessCode: string; message: string } | null>(null);
  const ordered = [...groups].sort((left, right) => Number(right.grantsAdmin) - Number(left.grantsAdmin));

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <EmptyState title="Add the first group" body="Create a group, choose whether its requests need approval, and add access codes." />
      ) : (
        ordered.map((group) => <GroupPanel key={group.id} group={group} onCode={setRevealed} />)
      )}
      <Card>
        <GroupSettingsForm />
      </Card>
      <Dialog open={Boolean(revealed)} title="Access code" onClose={() => setRevealed(null)}>
        {revealed ? (
          <div className="space-y-3 text-sm">
            <p>{revealed.message}</p>
            {revealed.accessCode ? (
              <p>
                {revealed.person}: <span className="font-mono text-base text-text">{revealed.accessCode}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function GroupPanel({
  group,
  onCode,
}: {
  group: GroupCard;
  onCode: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  return (
    <Card className="space-y-5">
      <GroupSettingsForm group={group} />
      <div className="space-y-3 border-t border-stroke pt-4">
        <h2 className="text-sm font-medium">Access codes</h2>
        {group.grantsAdmin ? (
          <p className="text-sm text-muted">Codes in this group sign in as administrators. This cannot be turned off.</p>
        ) : (
          <p className="text-sm text-muted">Each code belongs to one person. There is no separate role to pick.</p>
        )}
        {group.codes.length === 0 ? (
          <p className="text-sm text-muted">No access codes yet.</p>
        ) : (
          group.codes.map((code) => (
            <CodeRow
              key={`${code.userId}-${code.displayName}`}
              code={code}
              removeBlocked={group.grantsAdmin && group.codes.length <= 1}
              groupName={group.name}
              onCode={onCode}
            />
          ))
        )}
        <AddCodeForm groupId={group.id} onCode={onCode} />
      </div>
    </Card>
  );
}

function GroupSettingsForm({ group }: { group?: GroupCard }) {
  const toast = useToast();
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await saveGroup(null, formData);
    toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    if (result.ok && !group) setFormKey((value) => value + 1);
    return result;
  }, null);

  return (
    <form
      key={group ? `${group.id}-${group.name}-${group.approvalMode}-${group.membersCanReturn}` : formKey}
      action={action}
      className="space-y-3"
    >
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
      {!group ? <h2 className="font-medium">Create group</h2> : null}
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
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="membersCanReturn"
          value="yes"
          defaultChecked={group?.membersCanReturn ?? false}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Members can mark items returned</span>
          <span className="mt-1 block text-muted">
            When this is on, members can record returns for their own loans and for items an administrator checked out for this group.
          </span>
        </span>
      </label>
      {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : group ? "Save group" : "Create group"}
      </Button>
    </form>
  );
}

function AddCodeForm({
  groupId,
  onCode,
}: {
  groupId: string;
  onCode: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  const toast = useToast();
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (_previous: CodeResult | null, formData: FormData) => {
    const result = await addAccessCode(null, formData);
    if (result.ok && result.accessCode) {
      onCode({ person: result.person, accessCode: result.accessCode, message: result.message });
      setFormKey((value) => value + 1);
    } else toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    return result;
  }, null);

  return (
    <form key={formKey} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="min-w-48 flex-1">
        <Input label="Name for a new code" name="displayName" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add code"}
      </Button>
      {state && !state.ok ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

function CodeRow({
  code,
  removeBlocked,
  groupName,
  onCode,
}: {
  code: AccessCodeCard;
  removeBlocked: boolean;
  groupName: string;
  onCode: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  const [name, setName] = useState(code.displayName);
  const [confirming, setConfirming] = useState(false);
  const naming = usePendingAction();
  const viewing = usePendingAction();
  const rotating = usePendingAction();
  const removing = usePendingAction();
  const busy = naming.pending || viewing.pending || rotating.pending || removing.pending;

  return (
    <div className="space-y-2 rounded-lg border border-stroke px-3 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Button variant="secondary" disabled={busy || name.trim() === code.displayName} onClick={() => naming.run(() => renameAccessCode(code.userId, name))}>
          {naming.pending ? "Saving…" : "Save name"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            viewing.run(async () => {
              const result = await revealAccessCode(code.userId);
              if (result.ok) onCode({ person: result.person, accessCode: result.accessCode, message: result.message });
              return result.ok ? { ok: true, message: result.accessCode ? "Access code ready." : result.message } : result;
            })
          }
        >
          {viewing.pending ? "Opening…" : "See current"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            rotating.run(async () => {
              const result = await rotateAccessCode(code.userId);
              if (result.ok && result.accessCode) onCode({ person: result.person, accessCode: result.accessCode, message: result.message });
              return result.ok ? { ok: true, message: "Access code ready." } : result;
            })
          }
        >
          {rotating.pending ? "Rotating…" : "Rotate"}
        </Button>
        <Button variant="danger" disabled={busy || removeBlocked} onClick={() => setConfirming(true)}>
          Remove
        </Button>
      </div>
      {removeBlocked ? <p className="text-sm text-muted">The last code in {groupName} cannot be removed.</p> : null}
      {!code.viewable ? <p className="text-sm text-muted">This code is only stored as a hash. Rotate it once to make it viewable.</p> : null}
      <Dialog open={confirming} title="Remove this access code?" onClose={() => setConfirming(false)}>
        <p className="text-sm text-muted">{code.displayName} will not be able to sign in with it. Their name stays in history.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Keep code
          </Button>
          <Button
            variant="danger"
            disabled={removing.pending}
            onClick={() =>
              removing.run(
                () => removeAccessCode(code.userId),
                () => setConfirming(false),
              )
            }
          >
            {removing.pending ? "Removing…" : "Remove code"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
