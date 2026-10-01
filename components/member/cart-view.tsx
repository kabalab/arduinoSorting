"use client";

import { useState } from "react";
import { submitCart } from "@/src/actions/requests";
import { cartSubmitError, type Group, type Item, type StoreData, type User } from "@/src/domain";
import { todayDateString } from "@/src/domain/overdue";
import { useCart } from "./cart-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { usePendingAction } from "@/components/ui/use-pending";

export function CartView({ user, items, group }: { user: User; items: Item[]; group: Group }) {
  const cart = useCart();
  const [expectedReturn, setExpectedReturn] = useState("");
  const { pending, run } = usePendingAction();
  const now = new Date();
  const store: StoreData = {
    users: [user],
    credentials: [],
    groups: [group],
    items,
    ledger: [],
    requests: [],
    settings: { siteName: "" },
  };
  const reason = cartSubmitError(
    store,
    user,
    cart.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
    expectedReturn,
    now,
  );
  const note =
    group.approvalMode === "automatic"
      ? "Your group approves requests automatically. This will check out as soon as you submit it, if the supplies are still available."
      : "Your group requires approval. This request will stay pending until an administrator approves it.";

  if (cart.lines.length === 0) {
    return <EmptyState title="Your request is empty" body="Add supplies from the catalog. The cart stays in this tab until you submit or refresh." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{note}</p>
      <div className="space-y-3">
        {cart.lines.map((line) => {
          const item = items.find((entry) => entry.id === line.itemId);
          return (
            <Card key={line.itemId} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{item?.name ?? "Removed supply"}</h2>
                <p className="text-sm text-muted">{item ? `${item.available} available` : "This supply is no longer in the catalog."}</p>
              </div>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  value={line.quantity}
                  min={1}
                  max={item?.available}
                  onChange={(quantity) => cart.setQuantity(line.itemId, quantity)}
                  label={item?.name ?? "Quantity"}
                />
                <Button variant="ghost" onClick={() => cart.remove(line.itemId)}>
                  Remove
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <Input label="Expected return date" type="date" min={todayDateString(now)} value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} />
      {reason ? <p className="text-sm text-warning">{reason}</p> : null}
      <Button
        disabled={Boolean(reason) || pending}
        onClick={() =>
          run(
            () => submitCart(cart.lines, expectedReturn),
            () => cart.clear(),
          )
        }
      >
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </div>
  );
}
