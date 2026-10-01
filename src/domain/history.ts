import { formatDate } from "./format";
import { groupName, itemLabel, personName } from "./records";
import type { LedgerKind, StoreData } from "./types";

export type HistoryEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
};

const LEDGER_TITLE: Record<LedgerKind, string> = {
  added: "Stock added",
  adjusted: "Stock adjusted",
  checked_out: "Checked Out",
  returned: "Returned",
  removed: "Supply removed",
};

function requestItems(store: StoreData, requestId: string): string {
  const request = store.requests.find((entry) => entry.id === requestId);
  if (!request) return "a request";
  return request.lines.map((line) => `${itemLabel(store, line.itemId)} × ${line.quantityRequested}`).join(", ");
}

export function historyEvents(store: StoreData): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const request of store.requests) {
    const who = personName(store, request.requesterId);
    const group = groupName(store, request.groupId);
    const items = requestItems(store, request.id);
    events.push({
      id: `${request.id}:submitted`,
      at: request.createdAt,
      title: "Request submitted",
      detail: `${who} (${group}) requested ${items}. Expected return ${formatDate(request.expectedReturn)}.`,
    });
    if (request.approvedAt) {
      const approver = personName(store, request.approvedBy ?? request.requesterId);
      const automatic = request.approvedBy === request.requesterId;
      events.push({
        id: `${request.id}:approved`,
        at: request.approvedAt,
        title: "Approved",
        detail: automatic
          ? `${who}'s request for ${items} was approved automatically and checked out.`
          : `${approver} approved ${who}'s request for ${items}.`,
      });
    }
    if (request.status === "denied") {
      events.push({
        id: `${request.id}:denied`,
        at: request.createdAt,
        title: "Denied",
        detail: request.denialReason
          ? `${who}'s request was denied. ${request.denialReason}`
          : `${who}'s request was denied.`,
      });
    }
    if (request.status === "cancelled") {
      events.push({
        id: `${request.id}:cancelled`,
        at: request.createdAt,
        title: "Cancelled",
        detail: `${who} cancelled the request for ${items}.`,
      });
    }
    if (request.returnedAt) {
      events.push({
        id: `${request.id}:returned`,
        at: request.returnedAt,
        title: "Returned",
        detail: `${who}'s request for ${items} was fully returned.`,
      });
    }
  }

  for (const entry of store.ledger) {
    const actor = personName(store, entry.actorId);
    events.push({
      id: entry.id,
      at: entry.at,
      title: LEDGER_TITLE[entry.kind],
      detail: `${actor} changed ${entry.itemName} by ${entry.delta > 0 ? "+" : ""}${entry.delta}.`,
    });
  }

  return events.sort((left, right) => right.at.localeCompare(left.at));
}
