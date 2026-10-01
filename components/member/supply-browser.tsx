"use client";

import { useMemo, useState } from "react";
import { useCart } from "./cart-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useToast } from "@/components/ui/toast";

export type SupplyCard = {
  id: string;
  name: string;
  description: string;
  category: string;
  available: number;
  imageUrl: string;
};

export function SupplyBrowser({ supplies }: { supplies: SupplyCard[] }) {
  const [query, setQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const cart = useCart();
  const toast = useToast();
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      supplies.filter((supply) => {
        if (!needle) return true;
        return [supply.name, supply.category, supply.description].join(" ").toLowerCase().includes(needle);
      }),
    [needle, supplies],
  );

  if (supplies.length === 0) {
    return <EmptyState title="No supplies yet" body="Nothing is available for your group to request right now." />;
  }

  return (
    <div className="space-y-4">
      <Input label="Search supplies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, category, or description" />
      {visible.length === 0 ? (
        <EmptyState title="No matching supplies" body="Try a different search. Hidden supplies do not appear for your group." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((supply) => {
            const quantity = quantities[supply.id] ?? (supply.available > 0 ? 1 : 0);
            return (
              <Card key={supply.id} className="flex flex-col gap-3">
                {supply.imageUrl ? (
                  // User-provided addresses are not routed through the image optimizer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={supply.imageUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
                ) : null}
                <div>
                  <p className="text-xs text-muted">{supply.category}</p>
                  <h2 className="text-lg font-semibold">{supply.name}</h2>
                  {supply.description ? <p className="mt-1 text-sm text-muted">{supply.description}</p> : null}
                </div>
                <p className="text-sm">{supply.available} available</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <QuantityStepper
                    value={quantity}
                    min={supply.available > 0 ? 1 : 0}
                    max={supply.available}
                    onChange={(value) => setQuantities((current) => ({ ...current, [supply.id]: value }))}
                    label={`${supply.name} quantity`}
                  />
                  <Button
                    disabled={supply.available < 1 || quantity < 1}
                    onClick={() => {
                      cart.add(supply.id, quantity);
                      toast({ kind: "success", text: `${supply.name} added to your request.` });
                    }}
                  >
                    Add to Request
                  </Button>
                </div>
                {supply.available < 1 ? <p className="text-sm text-muted">None available right now.</p> : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
