export const STORE = "tic-quest.workspace.v8";
export const PREVIOUS = STORE + ".previous";

export class StorageConflictError extends Error {
  constructor() {
    super("Outra janela alterou ou eliminou os dados.");
    this.name = "StorageConflictError";
  }
}

/** Compare the complete snapshot: active-class changes can share a revision. */
export function writeWorkspace(storage, workspace, expectedSnapshot) {
  const existing = storage.getItem(STORE);
  if (existing !== expectedSnapshot) throw new StorageConflictError();
  const serialized = JSON.stringify(workspace);
  if (existing && existing !== serialized) storage.setItem(PREVIOUS, existing);
  storage.setItem(STORE, serialized);
  return serialized;
}
