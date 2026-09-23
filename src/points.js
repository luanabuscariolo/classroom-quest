/** Historical slots must still belong to the recorded student before undo. */
export function canUndo(classroom, event) {
  return (
    !event.undoneAt &&
    event.recipients.every(({ slot, name }) => {
      const student = classroom.students[slot];
      return (
        student &&
        student.name === name &&
        Number.isSafeInteger(student.points - event.points)
      );
    })
  );
}
