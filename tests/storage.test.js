import test from "node:test";
import assert from "node:assert/strict";
import {
  STORE,
  PREVIOUS,
  writeWorkspace,
  StorageConflictError,
} from "../src/storage.js";
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
}
test("save retains the previous snapshot and detects conflicts with unchanged revisions", () => {
  const s = memoryStorage();
  const old = writeWorkspace(s, { revision: 1, activeClassId: "a" }, null);
  const next = writeWorkspace(s, { revision: 1, activeClassId: "b" }, old);
  assert.equal(s.getItem(PREVIOUS), old);
  assert.throws(
    () => writeWorkspace(s, { revision: 2 }, old),
    StorageConflictError,
  );
  assert.equal(s.getItem(STORE), next);
  s.removeItem(STORE);
  assert.throws(
    () => writeWorkspace(s, { revision: 2 }, next),
    StorageConflictError,
  );
});
test("quota errors propagate without claiming a successful write", () => {
  assert.throws(
    () =>
      writeWorkspace(
        {
          getItem: () => null,
          setItem: () => {
            throw Error("QuotaExceededError");
          },
        },
        { revision: 1 },
        null,
      ),
    /Quota/,
  );
});
