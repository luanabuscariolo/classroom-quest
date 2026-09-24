import { sameStudent } from "./students.js";

/** Undo only while every slot still holds the recorded student. */
export function canUndo(classroom, event) {
  return (
    !event.undoneAt &&
    event.recipients.every(
      (r) =>
        sameStudent(classroom, r) &&
        Number.isSafeInteger(classroom.students[r.slot].points - event.points),
    )
  );
}
