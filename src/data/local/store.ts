import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreData } from "@/src/domain/types";
import type { Repository } from "@/src/data/repository";
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
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    const seeded = await createSeed();
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(seeded, null, 2), "utf8");
    return seeded;
  }
}

async function persist(store: StoreData): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const temporary = `${STORE_PATH}.tmp`;
  await writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
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
