"use client";

import { useState } from "react";
import { approvePending, cancelOwnRequest, denyPending, markReturned } from "@/src/actions/requests";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { usePendingAction } from "@/components/ui/use-pending";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const { pending, run } = usePendingAction();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => run(() => cancelOwnRequest(requestId))}>
      {pending ? "Cancelling…" : "Cancel request"}
    </Button>
  );
}

export function ApproveButton({ requestId }: { requestId: string }) {
  const { pending, run } = usePendingAction();
  return (
    <Button disabled={pending} onClick={() => run(() => approvePending(requestId))}>
      {pending ? "Approving…" : "Approve"}
    </Button>
  );
}

export function DenyButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = usePendingAction();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Deny
      </Button>
      <Dialog open={open} title="Deny this request?" onClose={() => setOpen(false)}>
        <p className="text-sm text-muted">The requester will see the request as denied. A reason is optional.</p>
        <label className="mt-3 block space-y-1.5 text-sm">
          <span>Denial reason</span>
          <textarea className="min-h-24 w-full rounded-lg border border-stroke bg-background px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep pending
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              run(
                () => denyPending(requestId, reason),
                () => setOpen(false),
              )
            }
          >
            {pending ? "Denying…" : "Deny request"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function ReturnPanel({
  requestId,
  lines,
}: {
  requestId: string;
  lines: { itemId: string; name: string; outstanding: number }[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((line) => [line.itemId, line.outstanding])),
  );
  const [open, setOpen] = useState(false);
  const { pending, run } = usePendingAction();
  const summary = lines
    .map((line) => `${quantities[line.itemId] ?? 0} ${line.name}`)
    .join(", ");

  return (
    <div className="space-y-3">
      {lines.map((line) => (
        <div key={line.itemId} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{line.name}</p>
            <p className="text-sm text-muted">{line.outstanding} still out</p>
          </div>
          <QuantityStepper
            value={quantities[line.itemId] ?? 0}
            min={0}
            max={line.outstanding}
            onChange={(value) => setQuantities((current) => ({ ...current, [line.itemId]: value }))}
            label={`${line.name} return quantity`}
          />
        </div>
      ))}
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Mark Returned
      </Button>
      <Dialog open={open} title="Record this return?" onClose={() => setOpen(false)}>
        <p className="text-sm text-muted">Stock increases only by the amounts below. {summary}.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  markReturned(
                    requestId,
                    lines.map((line) => ({ itemId: line.itemId, quantity: quantities[line.itemId] ?? 0 })),
                  ),
                () => setOpen(false),
              )
            }
          >
            {pending ? "Saving…" : "Mark Returned"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
