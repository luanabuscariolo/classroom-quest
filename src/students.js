import { uid } from "./utils.js";

/**
 * Student identity. A class has 30 fixed slots; each named student also has
 * an `id` that survives renames. History events, attendance rows and notes
 * store { slot, studentId, name }. Records from before version 11 may have
 * `studentId: null`; those still fall back to comparing the name.
 */

export function emptyStudent() {
  return {
    id: null,
    name: "",
    points: 0,
    inPool: false,
    gender: "robot",
    avatar: null,
    avatarMode: "auto",
  };
}

/**
 * Change the name in a slot. An empty slot that gets a name becomes a new
 * student; changing an existing name is a correction (same student).
 * Clearing the name is not handled here: use removeStudent().
 */
export function setStudentName(student, name) {
  if (!name) throw Error("Use removeStudent() to clear a slot.");
  if (student.name === name) return "same";
  const isNew = !student.name;
  student.name = name;
  if (isNew) {
    student.id = uid();
    student.inPool = true;
  }
  return isNew ? "new" : "renamed";
}

/** Free the slot. Past records keep the old id and name. */
export function removeStudent(student) {
  Object.assign(student, emptyStudent());
}

/** Does this slot still hold the student recorded in a history/diary entry? */
export function sameStudent(classroom, record) {
  const student = classroom.students[record.slot];
  if (!student || !student.name) return false;
  return record.studentId
    ? student.id === record.studentId
    : student.name === record.name;
}

/** The { slot, studentId, name } reference stored in records. */
export function studentRef(classroom, slot) {
  const student = classroom.students[slot];
  return { slot, studentId: student.id, name: student.name };
}
