import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureAccessModel } from "@/src/domain/records";
import type { StoreData } from "@/src/domain/types";
import type { Repository } from "@/src/data/repository";
import { CODE_KEY_PATH, loadCodeKey, openCredentials, sealCredentials, storeHasSealedCode } from "./code-seal";
import { ensureResetFile } from "./reset-code";
import { createSeed, STORE_PATH } from "./seed";

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadOrSeed(): Promise<StoreData> {
  const store = await readOrSeed();
  await ensureResetFile(store.users);
  return store;
}

async function readOrSeed(): Promise<StoreData> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    const key = await loadCodeKey(CODE_KEY_PATH, !storeHasSealedCode(parsed));
    const opened = openCredentials(parsed, key);
    const normalized = ensureAccessModel(opened.store);
    if (normalized.changed || opened.reseal) await persist(normalized.store, key);
    return normalized.store;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    const seeded = await createSeed();
    await persist(seeded);
    return seeded;
  }
}

async function persist(store: StoreData, key?: Buffer): Promise<void> {
  const sealed = sealCredentials(store, key ?? (await loadCodeKey()));
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const temporary = `${STORE_PATH}.tmp`;
  await writeFile(temporary, JSON.stringify(sealed, null, 2), "utf8");
  try {
    await rename(temporary, STORE_PATH);
  } catch {
    await copyFile(temporary, STORE_PATH);
    await unlink(temporary);
  }
}

export const localRepository: Repository = {
  read() {
    return enqueue(() => loadOrSeed());
  },
  update(mutate) {
    return enqueue(async () => {
      const current = await loadOrSeed();
      const { store, result } = mutate(current);
      if (store !== current) await persist(store);
      return result;
    });
  },
};
