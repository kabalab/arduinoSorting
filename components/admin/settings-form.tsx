"use client";

import { useActionState } from "react";
import { saveSettings } from "@/src/actions/admin";
import type { ActionResult } from "@/src/actions/result";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function SettingsForm({ siteName }: { siteName: string }) {
  const toast = useToast();
  const [state, action, pending] = useActionState(async (_previous: ActionResult | null, formData: FormData) => {
    const result = await saveSettings(null, formData);
    toast(result.ok ? { kind: "success", text: result.message } : { kind: "error", text: result.error });
    return result;
  }, null);

  return (
    <Card className="max-w-xl space-y-4">
      <form action={action} className="space-y-3">
        <Input label="Site name" name="siteName" defaultValue={siteName} required />
        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Database connection will be configured later. Until then, inventory and requests stay in the local server store.
      </p>
    </Card>
  );
}
