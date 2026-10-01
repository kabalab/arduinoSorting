import type { Item } from "./types";

export function suggestItems(query: string, items: Item[], exceptId?: string): Item[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return items
    .filter((item) => item.id !== exceptId && item.name.toLowerCase().includes(needle))
    .slice(0, 8);
}

export function exactNameMatch(name: string, items: Item[], exceptId?: string): Item | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return items.find((item) => item.id !== exceptId && item.name.trim().toLowerCase() === needle) ?? null;
}
