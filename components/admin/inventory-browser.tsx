"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addSupply, changeQuantity } from "@/src/actions/inventory";
import { exactNameMatch, suggestItems } from "@/src/domain/names";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, TextArea } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { StackedTable } from "@/components/ui/stacked-table";
import { useToast } from "@/components/ui/toast";
import { usePendingAction } from "@/components/ui/use-pending";

export type InventoryRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  available: number;
  checkedOut: number;
  total: number;
  restriction: string;
};

type GroupOption = { id: string; name: string };

export function InventoryBrowser({ rows, groups }: { rows: InventoryRow[]; groups: GroupOption[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [adding, setAdding] = useState(false);
  const categories = [...new Set(rows.map((row) => row.category))].sort();
  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    const matchesCategory = category === "all" || row.category === category;
    const matchesQuery = !needle || [row.name, row.category, row.description].join(" ").toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, category, or description" />
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select className="rounded-lg border border-stroke bg-background px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => setAdding(true)}>Add supply</Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Add the first supply" body="The catalog is empty. Add a supply so people can request it." action={<Button onClick={() => setAdding(true)}>Add supply</Button>} />
      ) : visible.length === 0 ? (
        <EmptyState title="No matching supplies" body="Try another search or category." />
      ) : (
        <StackedTable
          columns={[
            { key: "name", label: "Supply" },
            { key: "category", label: "Category" },
            { key: "available", label: "Available" },
            { key: "checkedOut", label: "Checked out" },
            { key: "total", label: "Total" },
            { key: "restriction", label: "Requests" },
            { key: "quantity", label: "Quantity" },
          ]}
          rows={visible.map((row) => ({
            key: row.id,
            cells: {
              name: (
                <Link className="font-medium text-accent" href={`/admin/inventory/${row.id}`}>
                  {row.name}
                </Link>
              ),
              category: row.category,
              available: row.available,
              checkedOut: row.checkedOut,
              total: row.total,
              restriction: row.restriction,
              quantity: <StockStepper itemId={row.id} available={row.available} />,
            },
          }))}
        />
      )}
      <AddSupplyDialog open={adding} groups={groups} items={rows} onClose={() => setAdding(false)} />
    </div>
  );
}

function StockStepper({ itemId, available }: { itemId: string; available: number }) {
  const { pending, run } = usePendingAction();
  return (
    <QuantityStepper
      value={available}
      min={0}
      onChange={(next) => {
        if (pending) return;
        const delta = next - available;
        if (delta !== 0) void run(() => changeQuantity(itemId, delta));
      }}
      label="Available quantity"
    />
  );
}

function AddSupplyDialog({
  open,
  groups,
  items,
  onClose,
}: {
  open: boolean;
  groups: GroupOption[];
  items: InventoryRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const catalog = useMemo(
    () => items.map((item) => ({ ...item, imageUrl: "", requestBlacklist: [], checkedOut: item.checkedOut, available: item.available, description: item.description, category: item.category })),
    [items],
  );
  const suggestions = suggestItems(name, catalog);
  const exact = exactNameMatch(name, catalog);
  const [state, formAction, pending] = useActionState(async (_previous: { ok: false; error: string } | null, formData: FormData) => {
    const result = await addSupply(null, formData);
    if (result.ok) {
      toast({ kind: "success", text: result.message });
      setName("");
      onClose();
      return null;
    }
    return result;
  }, null);

  return (
    <Dialog open={open} title="Add supply" onClose={onClose}>
      <form action={formAction} className="space-y-3">
        <Input label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        {suggestions.length > 0 ? (
          <div className="rounded-lg border border-stroke bg-background p-3 text-sm">
            <p className="text-muted">Existing supplies</p>
            <ul className="mt-2 space-y-1">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="text-accent"
                    onClick={() => {
                      onClose();
                      router.push(`/admin/inventory/${item.id}`);
                    }}
                  >
                    Open {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <TextArea label="Description" name="description" />
        <Input label="Category" name="category" required />
        <Input label="Image address" name="imageUrl" placeholder="https://" hint="Optional. Leave blank if there is no image." />
        <Input label="Available" name="available" type="number" min={0} defaultValue={1} required />
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">Who cannot request this</legend>
          <p className="text-xs text-muted">Leave this empty and anyone can request it.</p>
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-2">
              <input type="checkbox" name="blacklist" value={group.id} />
              {group.name}
            </label>
          ))}
        </fieldset>
        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
        {exact ? (
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/admin/inventory/${exact.id}`);
            }}
          >
            Open {exact.name}
          </Button>
        ) : (
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Adding…" : "Create new supply"}
          </Button>
        )}
      </form>
    </Dialog>
  );
}
