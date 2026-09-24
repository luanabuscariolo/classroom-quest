import {
  STORE,
  PREVIOUS,
  writeWorkspace,
  StorageConflictError,
} from "./storage.js";
import { emptyWorkspace, validateWorkspace } from "./model.js";

/**
 * Owns the workspace and its local copy. After a conflict or an unreadable
 * save, writes stay blocked so data from another window is never overwritten.
 * `getStorage` is a function because merely reading `localStorage` can throw.
 */
export function createPersistence(getStorage, onStatus) {
  let workspace = null,
    storageOK = true,
    storageBlocked = false,
    localSnapshot = null;

  function block() {
    storageBlocked = true;
    storageOK = false;
  }
  function load() {
    try {
      const raw = getStorage().getItem(STORE);
      localSnapshot = raw;
      if (raw) workspace = validateWorkspace(JSON.parse(raw));
    } catch (e) {
      try {
        const prev = getStorage().getItem(PREVIOUS);
        if (prev) {
          workspace = validateWorkspace(JSON.parse(prev));
          workspace.lastBackup = null;
          block();
        }
      } catch (ignore) {
        /* Recovery failed; the check below keeps writes blocked. */
      }
      if (!workspace) block();
    }
    if (!workspace) workspace = emptyWorkspace();
  }
  function persist() {
    if (!workspace) return;
    if (storageBlocked) {
      storageOK = false;
      onStatus();
      return;
    }
    try {
      localSnapshot = writeWorkspace(getStorage(), workspace, localSnapshot);
      storageOK = true;
    } catch (e) {
      if (e instanceof StorageConflictError) storageBlocked = true;
      storageOK = false;
    }
    onStatus();
  }
  function dirty() {
    workspace.revision++;
    persist();
  }
  /** Restore an imported workspace; the user confirmed replacing local data. */
  function replace(imported) {
    imported.revision = workspace.revision + 1;
    imported.lastBackup = null;
    workspace = imported;
    storageBlocked = false;
    try {
      localSnapshot = getStorage().getItem(STORE);
    } catch (e) {
      storageBlocked = true;
    }
    persist();
  }
  function needsBackup() {
    return (
      !workspace.lastBackup ||
      workspace.lastBackup.revision !== workspace.revision
    );
  }
  function confirmBackup(revision, date) {
    workspace.lastBackup = { revision, date };
    persist();
  }
  return {
    get workspace() {
      return workspace;
    },
    get storageOK() {
      return storageOK;
    },
    get storageBlocked() {
      return storageBlocked;
    },
    load,
    persist,
    dirty,
    replace,
    block,
    needsBackup,
    confirmBackup,
  };
}
