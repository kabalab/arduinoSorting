"use client";

import { Button } from "./button";

export function QuantityStepper({
  value,
  min = 0,
  max,
  onChange,
  label = "Quantity",
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const decreaseDisabled = value <= min;
  const increaseDisabled = max !== undefined && value >= max;
  return (
    <div className="inline-flex items-center gap-2" aria-label={label}>
      <Button variant="secondary" className="h-9 w-9 px-0" disabled={decreaseDisabled} onClick={() => onChange(value - 1)} aria-label={`Decrease ${label}`}>
        −
      </Button>
      <span className="min-w-8 text-center text-sm tabular-nums">{value}</span>
      <Button variant="secondary" className="h-9 w-9 px-0" disabled={increaseDisabled} onClick={() => onChange(value + 1)} aria-label={`Increase ${label}`}>
        +
      </Button>
    </div>
  );
}
