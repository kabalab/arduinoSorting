"use client";

import { useState } from "react";
import { checkoutForGroup } from "@/src/actions/requests";
import { todayDateString } from "@/src/domain/overdue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { usePendingAction } from "@/components/ui/use-pending";

type GroupOption = { id: string; name: string };
type ItemOption = { id: string; name: string; available: number };

export function AdminCheckoutForm({ groups, items }: { groups: GroupOption[]; items: ItemOption[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { pending, run } = usePendingAction();
  const today = todayDateString(new Date());
  const lines = items
    .map((item) => ({ itemId: item.id, quantity: quantities[item.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const reason = !groupId
    ? "Choose a group."
    : !expectedReturn
      ? "Enter an expected return date."
      : lines.length === 0
        ? "Choose a quantity for at least one supply."
        : null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-medium">Check out to a group</h2>
        <p className="mt-1 text-sm text-muted">
          This checks the items out immediately, even when that group normally needs approval, and even when a supply is hidden from the group. Stock still has to be available.
        </p>
      </div>
      <Select label="Group" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </Select>
      <Input label="Expected return date" type="date" min={today} value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} />
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted">{item.available} available</p>
            </div>
            <QuantityStepper
              value={quantities[item.id] ?? 0}
              min={0}
              max={item.available}
              onChange={(value) => setQuantities((current) => ({ ...current, [item.id]: value }))}
              label={`${item.name} checkout quantity`}
            />
          </div>
        ))}
      </div>
      {reason ? <p className="text-sm text-warning">{reason}</p> : null}
      <Button
        disabled={Boolean(reason) || pending}
        onClick={() =>
          run(
            () => checkoutForGroup(groupId, lines, expectedReturn),
            () => {
              setQuantities({});
              setExpectedReturn("");
            },
          )
        }
      >
        {pending ? "Checking out…" : "Check out"}
      </Button>
    </Card>
  );
}
