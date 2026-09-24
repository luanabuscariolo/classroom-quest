import { sameStudent, studentRef } from "./students.js";
import { dateLabel, dayISO, uid } from "./utils.js";

/** Diary rules and plain-text reports. No DOM: tested in tests/diary.test.js. */

export const ATTENDANCE_LABELS = {
  unmarked: "Por marcar",
  present: "Presente",
  absent: "Falta",
  late: "Atraso",
};
export const DELIVERY_LABELS = {
  pending: "Por verificar",
  delivered: "Entregue",
  missing: "Não entregue",
  excused: "Dispensado",
};

/** New lesson with the next number and one attendance row per named student. */
export function createLesson(c, diary, date, teacher) {
  return {
    id: uid(),
    date,
    number: Math.min(
      10000,
      1 + diary.lessons.reduce((n, l) => Math.max(n, l.number), 0),
    ),
    teacher,
    summary: "",
    activities: "",
    homework: "",
    due: "",
    attendance: c.students.flatMap((s, i) =>
      s.name
        ? [
            {
              slot: i,
              studentId: s.id,
              name: s.name,
              status: "unmarked",
              note: "",
              delivery: "pending",
              awardId: null,
            },
          ]
        : [],
    ),
  };
}

export function wasRewarded(c, row) {
  return (
    !!row.awardId && c.history.some((h) => h.id === row.awardId && !h.undoneAt)
  );
}

/** Delivered homework not yet rewarded, whose slot still has the same student. */
export function rewardableRows(c, lesson) {
  return lesson.attendance.filter(
    (r) =>
      r.delivery === "delivered" && !wasRewarded(c, r) && sameStudent(c, r),
  );
}

/**
 * Give points for delivered homework: adds a history event and links each
 * row to it through `awardId`. Returns null when the limits would be exceeded.
 */
export function awardHomework(c, lesson, rows, points) {
  if (
    c.history.length >= 10000 ||
    rows.some((r) => !Number.isSafeInteger(c.students[r.slot].points + points))
  )
    return null;
  const event = {
    id: uid(),
    title: ("TPC · " + dateLabel(lesson.date) + " · " + lesson.homework).slice(
      0,
      100,
    ),
    date: new Date().toISOString(),
    points,
    recipients: rows.map((r) => studentRef(c, r.slot)),
    undoneAt: null,
  };
  c.history.push(event);
  rows.forEach((r) => {
    c.students[r.slot].points += points;
    r.awardId = event.id;
  });
  return event;
}

/** Point events recorded on a local day (YYYY-MM-DD). */
export function eventsOn(c, date) {
  return c.history.filter((h) => dayISO(new Date(h.date)) === date);
}

/** Days with lessons, notes or point events, most recent first. */
export function dayDates(c, diary) {
  const set = new Set();
  diary.lessons.forEach((l) => set.add(l.date));
  diary.notes.forEach((n) => set.add(n.date));
  c.history.forEach((h) => set.add(dayISO(new Date(h.date))));
  return Array.from(set).sort().reverse();
}

export function lessonReport(c, diary, lesson, privateNotes) {
  const lines = [
    "TIC QUEST · REGISTO DA AULA",
    "Turma: " + c.className,
    "Data: " + dateLabel(lesson.date),
    "Aula: " + lesson.number,
    "Professor: " + lesson.teacher,
    "",
    "SUMÁRIO",
    lesson.summary,
    "",
    "ATIVIDADES",
    lesson.activities,
    "",
    "TRABALHO DE CASA",
    lesson.homework,
    "Prazo: " + (lesson.due ? dateLabel(lesson.due) : "—"),
    "",
    "PRESENÇAS E ENTREGAS",
  ];
  lesson.attendance.forEach((r) => {
    lines.push(
      r.name +
        " · " +
        ATTENDANCE_LABELS[r.status] +
        " · TPC: " +
        DELIVERY_LABELS[r.delivery],
    );
    if (privateNotes && r.note) lines.push("  Observação privada: " + r.note);
  });
  if (privateNotes) {
    lines.push("", "NOTAS PRIVADAS DA DATA");
    diary.notes
      .filter((n) => n.date === lesson.date)
      .forEach((n) => {
        lines.push((n.slot === null ? "Turma" : n.name) + ": " + n.text);
      });
  }
  return lines.join("\n");
}

/** Everything recorded on one day, including private notes. */
export function dailyReport(c, diary, date) {
  const lines = ["REGISTO DIÁRIO · " + c.className, dateLabel(date), ""];
  diary.lessons
    .filter((l) => l.date === date)
    .sort((a, b) => a.number - b.number)
    .forEach((l) => {
      lines.push(
        "AULA " + l.number + " · " + l.teacher,
        "SUMÁRIO",
        l.summary || "—",
        "ATIVIDADES REALIZADAS",
        l.activities || "—",
        "PRESENÇAS",
      );
      l.attendance.forEach((r) => {
        lines.push(
          r.name +
            ": " +
            ATTENDANCE_LABELS[r.status] +
            (r.note ? " · " + r.note : ""),
        );
      });
      lines.push(
        "TPC",
        l.homework || "—",
        "Prazo: " + (l.due ? dateLabel(l.due) : "—"),
      );
      if (l.homework)
        l.attendance.forEach((r) => {
          lines.push(r.name + ": " + DELIVERY_LABELS[r.delivery]);
        });
      lines.push("");
    });
  const notes = diary.notes.filter((n) => n.date === date);
  lines.push("NOTAS GERAIS");
  lines.push(
    notes
      .filter((n) => n.slot === null)
      .map((n) => n.text)
      .join("\n") || "—",
  );
  lines.push("", "NOTAS POR ALUNO");
  lines.push(
    notes
      .filter((n) => n.slot !== null)
      .map((n) => n.name + ": " + n.text)
      .join("\n") || "—",
  );
  lines.push("", "PONTOS / ATIVIDADES");
  lines.push(
    eventsOn(c, date)
      .map(
        (h) =>
          (h.undoneAt ? "[ANULADO] " : "") +
          h.title +
          " · " +
          (h.points > 0 ? "+" : "") +
          h.points +
          " · " +
          h.recipients.map((r) => r.name).join(", "),
      )
      .join("\n") || "—",
  );
  return lines.join("\n");
}
