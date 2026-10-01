const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const name = MONTHS[month - 1];
  if (!year || !name || !day) return value;
  return `${name} ${day}, ${year}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const month = MONTHS[date.getUTCMonth()];
  let hours = date.getUTCHours();
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hours}:${minutes} ${suffix} UTC`;
}

export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}
