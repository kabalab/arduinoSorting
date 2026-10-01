export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export type CodeResult = { ok: true; message: string; accessCode: string; person: string } | { ok: false; error: string };
