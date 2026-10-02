export type Role = "admin" | "member";

export type ApprovalMode = "automatic" | "required";

export type StoredStatus =
  | "pending"
  | "checked_out"
  | "returned"
  | "denied"
  | "cancelled";

export type DisplayStatus = StoredStatus | "overdue" | "approved";

export type LedgerKind =
  | "added"
  | "adjusted"
  | "checked_out"
  | "returned"
  | "removed";

export type User = {
  id: string;
  displayName: string;
  role: Role;
  groupId: string;
  /** This person's requests check out immediately, or wait for approval. */
  approvalMode: ApprovalMode;
  /** This person may record returns for their own loans and admin checkouts for their group. */
  canReturn: boolean;
  /** This person can manage people, codes, and pending requests in their own group. */
  groupAdmin: boolean;
  /** The original administrator. Other administrators cannot view or change this code, or change their own. */
  primaryAdmin?: boolean;
};

export type Credential = {
  userId: string;
  codeHash: string;
  /** Plain code in memory so an administrator can view it. Encrypted when written to disk. Absent when only a hash was saved. */
  code?: string;
};

export type Group = {
  id: string;
  name: string;
  /** Codes in this group sign in as administrators. Cannot be turned off. */
  grantsAdmin: boolean;
};

export type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  requestBlacklist: string[];
  available: number;
  checkedOut: number;
};

export type LedgerEntry = {
  id: string;
  itemId: string;
  itemName: string;
  delta: number;
  kind: LedgerKind;
  actorId: string;
  at: string;
  requestId?: string;
};

export type RequestLine = {
  itemId: string;
  quantityRequested: number;
  quantityCheckedOut: number;
  quantityReturned: number;
};

export type EquipmentRequest = {
  id: string;
  groupId: string;
  requesterId: string;
  createdAt: string;
  expectedReturn: string;
  status: StoredStatus;
  approvedAt?: string;
  approvedBy?: string;
  denialReason?: string;
  checkedOutAt?: string;
  returnedAt?: string;
  lines: RequestLine[];
};

export type Settings = {
  siteName: string;
};

export type StoreData = {
  users: User[];
  credentials: Credential[];
  groups: Group[];
  items: Item[];
  ledger: LedgerEntry[];
  requests: EquipmentRequest[];
  settings: Settings;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: string };
export type Result<T> = Ok<T> | Err;

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  checked_out: "Checked Out",
  returned: "Returned",
  overdue: "Overdue",
  denied: "Denied",
  cancelled: "Cancelled",
};

export function fail(error: string): Err {
  return { ok: false, error };
}

export function itemTotal(item: Pick<Item, "available" | "checkedOut">): number {
  return item.available + item.checkedOut;
}

export function lineOutstanding(line: RequestLine): number {
  return line.quantityCheckedOut - line.quantityReturned;
}
