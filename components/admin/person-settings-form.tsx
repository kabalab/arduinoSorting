"use client";

import { useActionState, useState } from "react";
import { savePersonSettings } from "@/src/actions/admin";
import type { ActionResult } from "@/src/actions/result";
import type { ApprovalMode } from "@/src/domain/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export type PersonSettings = {
  userId: string;
  approvalMode: ApprovalMode;
  canReturn: boolean;
  groupAdmin: boolean;
};

/** Null means a site administrator, who can grant any of these settings. */
export type PermissionCeiling = {
  approvalMode: ApprovalMode;
  canReturn: boolean;
} | null;

const modes: { value: ApprovalMode; label: string }[] = [
  { value: "automatic", label: "Automatic" },
  { value: "required", label: "Approval required" },
];

export function PersonSettingsButton({
  personName,
  person,
  ceiling,
  showGroupAdmin,
}: {
  personName: string;
  person: PersonSettings;
  ceiling: PermissionCeiling;
  showGroupAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Settings
      </Button>
      <Dialog open={open} title={`${personName} settings`} onClose={() => setOpen(false)}>
        <PersonSettingsForm
          person={person}
          ceiling={ceiling}
          showGroupAdmin={showGroupAdmin}
          onSaved={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export function PersonSettingsForm({
  person,
  ceiling,
  showGroupAdmin,
  onSaved,
}: {
  person: PersonSettings;
  ceiling: PermissionCeiling;
  showGroupAdmin: boolean;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await savePersonSettings(null, formData);
    toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    if (result.ok) onSaved?.();
    return result;
  }, null);

  const automaticAllowed = ceiling === null || ceiling.approvalMode === "automatic" || person.approvalMode === "automatic";
  const returnAllowed = ceiling === null || ceiling.canReturn || person.canReturn;

  return (
    <form
      key={`${person.userId}-${person.approvalMode}-${person.canReturn}-${person.groupAdmin}`}
      action={action}
      className="space-y-3"
    >
      <input type="hidden" name="userId" value={person.userId} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Approval mode</legend>
        {modes.map((mode) => {
          const disabled = mode.value === "automatic" && !automaticAllowed;
          return (
            <label key={mode.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="approvalMode"
                value={mode.value}
                defaultChecked={person.approvalMode === mode.value}
                disabled={disabled}
              />
              {mode.label}
            </label>
          );
        })}
      </fieldset>
      {!automaticAllowed ? (
        <p className="text-sm text-muted">You cannot give automatic approval because your own requests require approval.</p>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="canReturn" value="yes" defaultChecked={person.canReturn} disabled={!returnAllowed} className="mt-1" />
        <span>Can mark items returned</span>
      </label>
      {ceiling && !ceiling.canReturn && !person.canReturn ? (
        <p className="text-sm text-muted">You cannot allow returns because you cannot mark items returned.</p>
      ) : null}
      {showGroupAdmin ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="groupAdmin" value="yes" defaultChecked={person.groupAdmin} className="mt-1" />
          <span>Group admin</span>
        </label>
      ) : (
        <input type="hidden" name="groupAdmin" value="no" />
      )}
      {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
