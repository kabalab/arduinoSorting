"use client";

import { useRef, useState } from "react";
import type { ActionResult } from "@/src/actions/result";
import { useToast } from "./toast";

export function usePendingAction() {
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const toast = useToast();

  async function run(task: () => Promise<ActionResult>, onSuccess?: () => void) {
    if (locked.current) return null;
    locked.current = true;
    setPending(true);
    try {
      const result = await task();
      toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
      if (result.ok) onSuccess?.();
      return result;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return { pending, run };
}
