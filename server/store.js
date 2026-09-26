import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { seed, expireHolds } from "./domain.js";
export async function createStore({
  mode = "local",
  legacyPath,
  path = ".data/state.json",
} = {}) {
  if (["postgres", "pglite"].includes(mode)) {
    const { createSqlStore } = await import("./sql-store.js");
    return createSqlStore({ mode, path, legacyPath });
  }
  const file = resolve(path);
  await mkdir(resolve(file, ".."), { recursive: true });
  let state;
  try {
    state = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    state = seed();
  }
  let queue = Promise.resolve();
  return {
    transact(fn) {
      const task = queue.then(async () => {
        const draft = structuredClone(state);
        expireHolds(draft);
        const result = await fn(draft);
        await writeFile(`${file}.tmp`, JSON.stringify(draft));
        await rename(`${file}.tmp`, file);
        state = draft;
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
