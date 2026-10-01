"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { changeQuantity, deleteSupply, saveSupply } from "@/src/actions/inventory";
import { exactNameMatch, suggestItems } from "@/src/domain/names";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, TextArea } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useToast } from "@/components/ui/toast";
import { usePendingAction } from "@/components/ui/use-pending";

type GroupOption = { id: string; name: string };
type NamedItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  requestBlacklist: string[];
  available: number;
  checkedOut: number;
};

export function ItemDetail({
  item,
  groups,
  items,
  restriction,
  ledger,
}: {
  item: NamedItem;
  groups: GroupOption[];
  items: NamedItem[];
  restriction: string;
  ledger: { id: string; text: string; when: string }[];
}) {
  const { pending, run } = usePendingAction();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Card className="space-y-3">
          <p className="text-sm text-muted">{restriction}</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <p><span className="block text-muted">Available</span>{item.available}</p>
            <p><span className="block text-muted">Checked out</span>{item.checkedOut}</p>
            <p><span className="block text-muted">Total</span>{item.available + item.checkedOut}</p>
          </div>
          <QuantityStepper
            value={item.available}
            min={0}
            onChange={(next) => {
              const delta = next - item.available;
              if (delta !== 0) void run(() => changeQuantity(item.id, delta));
            }}
            label="Available quantity"
          />
          {pending ? <p className="text-sm text-muted">Updating quantity…</p> : null}
        </Card>
        <EditForm item={item} groups={groups} items={items} />
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Remove supply
        </Button>
        <Dialog open={confirming} title="Remove this supply?" onClose={() => setConfirming(false)}>
          <p className="text-sm text-muted">
            {item.checkedOut > 0
              ? "This supply is still checked out. Return every unit before removing it."
              : "The supply leaves the catalog. Ledger history stays available."}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep supply
            </Button>
            <Button
              variant="danger"
              disabled={pending || item.checkedOut > 0}
              onClick={() =>
                run(
                  () => deleteSupply(item.id),
                  () => router.push("/admin/inventory"),
                )
              }
            >
              {pending ? "Removing…" : "Remove supply"}
            </Button>
          </div>
        </Dialog>
      </div>
      <Card>
        <h2 className="font-medium">Recent ledger</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No stock changes yet.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {ledger.map((entry) => (
              <li key={entry.id}>
                <p>{entry.text}</p>
                <p className="text-muted">{entry.when}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EditForm({ item, groups, items }: { item: NamedItem; groups: GroupOption[]; items: NamedItem[] }) {
  const [name, setName] = useState(item.name);
  const router = useRouter();
  const toast = useToast();
  const suggestions = suggestItems(name, items, item.id);
  const exact = exactNameMatch(name, items, item.id);
  const [state, formAction, pending] = useActionState(async (_previous: { ok: false; error: string } | null, formData: FormData) => {
    const result = await saveSupply(null, formData);
    toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    return result.ok ? null : result;
  }, null);

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="itemId" value={item.id} />
        <Input label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        {suggestions.length > 0 ? (
          <div className="rounded-lg border border-stroke bg-background p-3 text-sm">
            <p className="text-muted">This looks like an existing supply</p>
            <ul className="mt-2 space-y-1">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button type="button" className="text-accent" onClick={() => router.push(`/admin/inventory/${suggestion.id}`)}>
                    Open {suggestion.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <TextArea label="Description" name="description" defaultValue={item.description} />
        <Input label="Category" name="category" defaultValue={item.category} required />
        <Input label="Image address" name="imageUrl" defaultValue={item.imageUrl} placeholder="https://" />
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">Who cannot request this</legend>
          <p className="text-xs text-muted">Leave this empty and anyone can request it.</p>
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-2">
              <input type="checkbox" name="blacklist" value={group.id} defaultChecked={item.requestBlacklist.includes(group.id)} />
              {group.name}
            </label>
          ))}
        </fieldset>
        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
        {exact ? (
          <p className="text-sm text-warning">{exact.name} already exists. Open that supply instead of renaming this one to the same name.</p>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </form>
    </Card>
  );
}
