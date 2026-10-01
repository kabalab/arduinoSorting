import type { ReactNode } from "react";

export function PageHeader({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {body ? <p className="mt-1 max-w-2xl text-sm text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}
