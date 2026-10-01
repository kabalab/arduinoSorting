"use client";

import { useActionState, useState } from "react";
import { addAccessCode, removeAccessCode, renameAccessCode, revealAccessCode, rotateAccessCode, saveGroup } from "@/src/actions/admin";
import type { ActionResult, CodeResult } from "@/src/actions/result";
import type { ApprovalMode } from "@/src/domain/types";
import { PersonSettingsButton } from "@/components/admin/person-settings-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePendingAction } from "@/components/ui/use-pending";

export type AccessCodeCard = {
  userId: string;
  displayName: string;
  viewable: boolean;
  approvalMode: ApprovalMode;
  canReturn: boolean;
  groupAdmin: boolean;
  primaryAdmin: boolean;
};

export type CodeViewer = {
  id: string;
  siteAdmin: boolean;
  primary: boolean;
  approvalMode: ApprovalMode;
  canReturn: boolean;
};

type CodePowers = {
  rename: boolean;
  reveal: boolean;
  rotate: boolean;
  remove: boolean;
  settings: boolean;
  note: string | null;
};

function codePowers(code: AccessCodeCard, viewer: CodeViewer, grantsAdmin: boolean): CodePowers {
  if (viewer.siteAdmin) {
    const secondary = !viewer.primary;
    const self = code.userId === viewer.id;
    const original = code.primaryAdmin;
    return {
      rename: true,
      reveal: !(secondary && original),
      rotate: !(secondary && (self || original)),
      remove: viewer.primary && !original,
      settings: !grantsAdmin,
      note:
        secondary && original
          ? "You cannot view or change the original administrator's code."
          : secondary && self
            ? "You cannot change your own access code."
            : null,
    };
  }
  const self = code.userId === viewer.id;
  return {
    rename: true,
    reveal: true,
    rotate: true,
    remove: false,
    settings: !self,
    note: self ? "An administrator sets your own approval mode, return permission, and group admin setting." : null,
  };
}

export type GroupCard = {
  id: string;
  name: string;
  grantsAdmin: boolean;
  codes: AccessCodeCard[];
};

function permissionSummary(code: AccessCodeCard, grantsAdmin: boolean): string {
  const approval = code.approvalMode === "automatic" ? "Checks out immediately" : "Needs approval";
  const returns = code.canReturn ? "Can mark items returned" : "Cannot mark items returned";
  const admin = !grantsAdmin && code.groupAdmin ? "Group admin" : "";
  return [approval, returns, admin].filter(Boolean).join(" · ");
}

export function GroupsManager({ groups, viewer }: { groups: GroupCard[]; viewer: CodeViewer }) {
  const [revealed, setRevealed] = useState<{ person: string; accessCode: string; message: string } | null>(null);
  const ordered = [...groups].sort((left, right) => Number(right.grantsAdmin) - Number(left.grantsAdmin));

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <EmptyState title="Add the first group" body="Create a group and add access codes. Set each person's permissions with Settings." />
      ) : (
        ordered.map((group) => <GroupPanel key={group.id} group={group} viewer={viewer} onCode={setRevealed} />)
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
  viewer,
  onCode,
}: {
  group: GroupCard;
  viewer: CodeViewer;
  onCode: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  return (
    <Card className="space-y-5">
      <GroupSettingsForm group={group} />
      <div className="border-t border-stroke pt-4">
        <PeopleCodes
          groupId={group.id}
          groupName={group.name}
          grantsAdmin={group.grantsAdmin}
          codes={group.codes}
          viewer={viewer}
          onCode={onCode}
        />
      </div>
    </Card>
  );
}

export function PeopleCodes({
  groupId,
  groupName,
  grantsAdmin,
  codes,
  viewer,
  onCode,
}: {
  groupId: string;
  groupName: string;
  grantsAdmin: boolean;
  codes: AccessCodeCard[];
  viewer: CodeViewer;
  onCode?: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  const [revealed, setRevealed] = useState<{ person: string; accessCode: string; message: string } | null>(null);
  const showCode = onCode ?? setRevealed;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">Access codes</h2>
      {grantsAdmin ? (
        <p className="text-sm text-muted">
          Codes in this group sign in as administrators. Change a name, see the current code, rotate it, or add another administrator. The original administrator is the only one who can view or change that code.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Each code belongs to one person. New people need approval and cannot mark items returned until you change their settings.
        </p>
      )}
      {codes.length === 0 ? (
        <p className="text-sm text-muted">No access codes yet.</p>
      ) : (
        codes.map((code) => (
          <CodeRow
            key={`${code.userId}-${code.displayName}-${code.approvalMode}-${code.canReturn}-${code.groupAdmin}-${code.primaryAdmin}`}
            code={code}
            removeBlocked={grantsAdmin && codes.length <= 1}
            groupName={groupName}
            grantsAdmin={grantsAdmin}
            viewer={viewer}
            onCode={showCode}
          />
        ))
      )}
      <AddCodeForm groupId={groupId} label={grantsAdmin ? "Name for a new administrator" : "Name for a new code"} onCode={showCode} />
      {onCode ? null : (
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
      )}
    </div>
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
      key={group ? `${group.id}-${group.name}` : formKey}
      action={action}
      className="space-y-3"
    >
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
      {!group ? <h2 className="font-medium">Create group</h2> : null}
      <Input label={group ? "Group name" : "New group name"} name="name" defaultValue={group?.name ?? ""} required />
      {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : group ? "Save group" : "Create group"}
      </Button>
    </form>
  );
}

function AddCodeForm({
  groupId,
  label,
  onCode,
}: {
  groupId: string;
  label: string;
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
        <Input label={label} name="displayName" required />
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
  grantsAdmin,
  viewer,
  onCode,
}: {
  code: AccessCodeCard;
  removeBlocked: boolean;
  groupName: string;
  grantsAdmin: boolean;
  viewer: CodeViewer;
  onCode: (value: { person: string; accessCode: string; message: string }) => void;
}) {
  const [name, setName] = useState(code.displayName);
  const [confirming, setConfirming] = useState(false);
  const naming = usePendingAction();
  const viewing = usePendingAction();
  const rotating = usePendingAction();
  const removing = usePendingAction();
  const busy = naming.pending || viewing.pending || rotating.pending || removing.pending;
  const powers = codePowers(code, viewer, grantsAdmin);
  const showRemove = powers.remove;

  return (
    <div className="space-y-2 rounded-lg border border-stroke px-3 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        {powers.rename ? (
          <Button variant="secondary" disabled={busy || name.trim() === code.displayName} onClick={() => naming.run(() => renameAccessCode(code.userId, name))}>
            {naming.pending ? "Saving…" : "Save name"}
          </Button>
        ) : null}
        {powers.reveal ? (
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
        ) : null}
        {powers.rotate ? (
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
        ) : null}
        {powers.settings ? (
          <PersonSettingsButton
            personName={code.displayName}
            person={code}
            ceiling={viewer.siteAdmin ? null : { approvalMode: viewer.approvalMode, canReturn: viewer.canReturn }}
            showGroupAdmin={!grantsAdmin}
          />
        ) : null}
        {showRemove ? (
          <Button variant="danger" disabled={busy || removeBlocked} onClick={() => setConfirming(true)}>
            Remove
          </Button>
        ) : null}
      </div>
      {powers.settings ? <p className="text-sm text-muted">{permissionSummary(code, grantsAdmin)}</p> : null}
      {powers.note ? <p className="text-sm text-muted">{powers.note}</p> : null}
      {showRemove && removeBlocked ? <p className="text-sm text-muted">The last code in {groupName} cannot be removed.</p> : null}
      {!code.viewable && powers.rotate ? <p className="text-sm text-muted">This code is only stored as a hash. Rotate it once to make it viewable.</p> : null}
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
