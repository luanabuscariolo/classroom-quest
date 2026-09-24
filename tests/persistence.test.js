import test from "node:test";
import assert from "node:assert/strict";
import { createPersistence } from "../src/persistence.js";
import { STORE, PREVIOUS } from "../src/storage.js";
import { emptyWorkspace } from "../src/model.js";

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    data,
  };
}
function saved(revision) {
  return JSON.stringify({ ...emptyWorkspace(), revision });
}

test("empty storage starts a new workspace and saves changes", () => {
  const storage = memoryStorage();
  let statusCalls = 0;
  const p = createPersistence(
    () => storage,
    () => statusCalls++,
  );
  p.load();
  assert.equal(p.workspace.revision, 0);
  p.dirty();
  assert.equal(JSON.parse(storage.getItem(STORE)).revision, 1);
  assert.equal(p.storageOK, true);
  assert.equal(statusCalls, 1);
});

test("an unreadable save opens the previous copy and blocks writes", () => {
  const storage = memoryStorage({ [STORE]: "{broken", [PREVIOUS]: saved(4) });
  const p = createPersistence(
    () => storage,
    () => {},
  );
  p.load();
  assert.equal(p.workspace.revision, 4);
  assert.equal(p.storageBlocked, true);
  p.dirty();
  assert.equal(storage.getItem(STORE), "{broken");
  assert.equal(p.storageOK, false);
});

test("without a usable copy the workspace is empty and writes stay blocked", () => {
  const storage = memoryStorage({ [STORE]: "{broken", [PREVIOUS]: "{also" });
  const p = createPersistence(
    () => storage,
    () => {},
  );
  p.load();
  assert.deepEqual(p.workspace.classes, []);
  assert.equal(p.storageBlocked, true);
});

test("inaccessible storage does not throw", () => {
  const p = createPersistence(
    () => {
      throw new Error("SecurityError");
    },
    () => {},
  );
  p.load();
  p.dirty();
  assert.equal(p.storageOK, false);
});

test("a change from another window blocks the next write", () => {
  const storage = memoryStorage({ [STORE]: saved(1) });
  const p = createPersistence(
    () => storage,
    () => {},
  );
  p.load();
  storage.setItem(STORE, saved(7));
  p.dirty();
  assert.equal(JSON.parse(storage.getItem(STORE)).revision, 7);
  assert.equal(p.storageBlocked, true);
});

test("restoring replaces the workspace, unblocks writes and needs a new backup", () => {
  const storage = memoryStorage({ [STORE]: "{broken" });
  const p = createPersistence(
    () => storage,
    () => {},
  );
  p.load();
  const imported = emptyWorkspace();
  imported.lastBackup = { date: new Date().toISOString(), revision: 0 };
  p.replace(imported);
  assert.equal(p.storageOK, true);
  assert.equal(p.workspace, imported);
  assert.equal(p.workspace.lastBackup, null);
  assert.equal(p.needsBackup(), true);
  p.confirmBackup(p.workspace.revision, new Date().toISOString());
  assert.equal(p.needsBackup(), false);
  p.dirty();
  assert.equal(p.needsBackup(), true);
});
