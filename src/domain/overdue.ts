import type { DisplayStatus, EquipmentRequest } from "./types";
import { lineOutstanding } from "./types";

export function todayDateString(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function utcDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function hasOutstandingQuantity(request: EquipmentRequest): boolean {
  return request.lines.some((line) => lineOutstanding(line) > 0);
}

export function isOverdue(request: EquipmentRequest, now: Date): boolean {
  if (request.status !== "checked_out") return false;
  if (!hasOutstandingQuantity(request)) return false;
  if (!isDateOnly(request.expectedReturn)) return false;
  return request.expectedReturn < todayDateString(now);
}

export function displayStatus(request: EquipmentRequest, now: Date): DisplayStatus {
  if (isOverdue(request, now)) return "overdue";
  return request.status;
}

export function wasApproved(request: EquipmentRequest): boolean {
  return Boolean(request.approvedAt);
}

export function daysOverdue(request: EquipmentRequest, now: Date): number {
  if (!isOverdue(request, now)) return 0;
  const diff = utcDay(todayDateString(now)) - utcDay(request.expectedReturn);
  return Math.round(diff / 86_400_000);
}

export function overdueLabel(request: EquipmentRequest, now: Date): string | null {
  const days = daysOverdue(request, now);
  if (days <= 0) return null;
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

export function matchesStatusFilter(
  request: EquipmentRequest,
  filter: string,
  now: Date,
): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "approved") return wasApproved(request);
  if (filter === "overdue") return isOverdue(request, now);
  return displayStatus(request, now) === filter;
}
