import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyWorkspace,
  validate,
  validClass,
  validateWorkspace,
  validateDiary,
  VERSION,
} from "../src/model.js";
import {
  packageBackup,
  parseBackup,
  parseBackupText,
  MAX_BACKUP_BYTES,
} from "../src/backup.js";
import { validDay } from "../src/utils.js";
import { canUndo } from "../src/points.js";

export function classroom() {
  return validClass({
    version: 6,
    className: "Teste",
    lives: 5,
    students: [{ name: "Ana", points: 2 }],
    groups: [],
    id: "class-1",
  });
}
test("backup round trip preserves data and rejects changed payload", () => {
  const w = emptyWorkspace();
  w.classes.push(classroom());
  w.activeClassId = "class-1";
  const backup = packageBackup(w);
  assert.deepEqual(
    parseBackupText("\uFEFF" + JSON.stringify(backup)).workspace,
    w,
  );
  backup.payload.classes[0].students[0].points++;
  assert.throws(() => parseBackup(backup), /integridade/);
});
test("old class formats and workspace versions remain readable", () => {
  for (let version = 1; version <= 6; version++) {
    const raw = {
      version,
      className: "Antiga",
      lives: 4,
      students: [{ id: "a", name: "Ana", points: 1 }],
      groups: [
        {
          points: 0,
          ...(version === 1 ? { memberIds: ["a"] } : { members: [0] }),
        },
      ],
    };
    const result = parseBackup(raw).workspace.classes[0];
    assert.equal(result.students.length, 30);
    assert.deepEqual(result.groups[0].members, [0]);
  }
  for (const version of [8, 9, 10, 11])
    assert.equal(
      validateWorkspace({ ...emptyWorkspace(), version }).version,
      VERSION,
    );
});
test("reject invalid student, repeated group members, duplicate classes and diary dates", () => {
  const c = classroom();
  c.students[0].points = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => validate(c));
  c.students[0].points = 0;
  c.groups = [{ points: 0, members: [0, 0] }];
  assert.throws(() => validate(c));
  const w = emptyWorkspace();
  w.classes = [classroom(), classroom()];
  assert.throws(() => validateWorkspace(w), /repetidos/);
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(validDay("2024-02-29"), true);
  assert.throws(() => validateDiary({ lessons: [{}], notes: [] }));
});
test("same size limit applies to pasted backups before parsing", () => {
  assert.throws(
    () => parseBackupText(" ".repeat(MAX_BACKUP_BYTES + 1)),
    /20 MB/,
  );
  assert.throws(
    () => parseBackupText("é".repeat(MAX_BACKUP_BYTES / 2 + 1)),
    /20 MB/,
  );
});
test("undo without a student id (before version 11) compares the name", () => {
  const c = classroom(),
    event = {
      points: 2,
      recipients: [{ slot: 0, studentId: null, name: "Ana" }],
      undoneAt: null,
    };
  assert.equal(canUndo(c, event), true);
  c.students[0].name = "Outra";
  assert.equal(canUndo(c, event), false);
  c.students[0].name = "Ana";
  c.students[0].points = -Number.MAX_SAFE_INTEGER;
  assert.equal(canUndo(c, event), false);
  c.students[0].points = 2;
  event.undoneAt = "2026-09-23";
  assert.equal(canUndo(c, event), false);
});
