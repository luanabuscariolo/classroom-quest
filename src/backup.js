import { copy, validDate } from "./utils.js";
import { validateWorkspace, validClass, emptyWorkspace } from "./model.js";

// Shared by file and paste imports; checked before JSON parsing.
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export function parseBackupText(text) {
  if (
    typeof text !== "string" ||
    text.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES
  ) {
    throw Error("Ficheiro demasiado grande. O limite é 20 MB.");
  }
  return parseBackup(JSON.parse(text.replace(/^\uFEFF/, "").trim()));
}
export function checksum(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export function packageBackup(w, scope) {
  const payload = copy(w);
  return {
    format: "tic-quest-backup",
    version: 10,
    exportedAt: new Date().toISOString(),
    scope: scope || "all",
    checksum: checksum(JSON.stringify(payload)),
    payload,
  };
}

export function parseBackup(raw) {
  if (raw && raw.format === "tic-quest-backup") {
    if ([8, 9, 10].indexOf(raw.version) < 0)
      throw Error("Backup de uma versão não suportada.");
    if (
      !validDate(raw.exportedAt) ||
      typeof raw.checksum !== "string" ||
      checksum(JSON.stringify(raw.payload)) !== raw.checksum
    )
      throw Error(
        "O ficheiro está incompleto ou foi alterado. A verificação de integridade falhou.",
      );
    return {
      workspace: validateWorkspace(raw.payload),
      date: raw.exportedAt,
      legacy: false,
      scope: raw.scope,
    };
  }
  if (raw && raw.format === "tic-quest-workspace")
    return { workspace: validateWorkspace(raw), date: null, legacy: false };
  const c = validClass(raw),
    w = emptyWorkspace();
  w.classes = [c];
  w.activeClassId = c.id;
  return { workspace: w, date: null, legacy: true };
}
