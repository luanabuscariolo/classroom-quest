import { LESSON_MARKS } from "./grading.js";
import { sameStudent, studentRef } from "./students.js";
import { dateLabel, dayISO, stampOn, uid } from "./utils.js";

/** Diary rules and plain-text reports. No DOM: tested in tests/diary.test.js. */

export const ATTENDANCE_LABELS = {
  unmarked: "Por marcar",
  present: "Presente",
  absent: "Falta",
  late: "Atraso",
  excused: "Falta justificada",
};
export const DELIVERY_LABELS = {
  pending: "Por verificar",
  delivered: "Entregue",
  missing: "Não entregue",
  excused: "Dispensado",
};

/** Behaviour, participation and material when they differ from the default. */
export function marksText(row) {
  const out = [];
  if (row.behavior && row.behavior !== "good")
    out.push("Comportamento: " + LESSON_MARKS.behavior[row.behavior]);
  if (row.participation && row.participation !== "normal")
    out.push("Participação: " + LESSON_MARKS.participation[row.participation]);
  if (row.material === false) out.push("Sem material");
  return out.join(" · ");
}

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
              behavior: "good",
              participation: "normal",
              material: true,
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
    // Recorded on the lesson day, so it shows up in that day's history.
    date: stampOn(lesson.date),
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
        (marksText(r) ? " · " + marksText(r) : "") +
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
            (marksText(r) ? " · " + marksText(r) : "") +
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

/** Class note of a day: the general note (not about one student). */
export function classNoteOn(diary, date) {
  return diary.notes.find((n) => n.date === date && n.slot === null) || null;
}

/**
 * Everything recorded on one day, grouped for an easy-to-read view:
 * per lesson the texts and who was absent, late, without material, etc.
 */
export function daySummary(c, diary, date) {
  const lessons = diary.lessons
    .filter((l) => l.date === date)
    .sort((a, b) => a.number - b.number)
    .map((l) => {
      const who = (test) => l.attendance.filter(test).map((r) => r.name);
      return {
        lesson: l,
        present: who((r) => !["absent", "excused"].includes(r.status)).length,
        groups: [
          ["Faltas", who((r) => r.status === "absent")],
          ["Faltas justificadas", who((r) => r.status === "excused")],
          ["Atrasos", who((r) => r.status === "late")],
          ["Sem material", who((r) => r.material === false)],
          ["Comportamento a melhorar", who((r) => r.behavior === "poor")],
          ["Comportamento regular", who((r) => r.behavior === "regular")],
          ["Participação ativa", who((r) => r.participation === "active")],
          ["Participação fraca", who((r) => r.participation === "low")],
          [
            "Entregaram a TPC desta aula",
            who((r) => r.delivery === "delivered"),
          ],
          [
            "Não entregaram a TPC desta aula",
            who((r) => r.delivery === "missing"),
          ],
        ].filter(([, names]) => names.length),
        observations: l.attendance
          .filter((r) => r.note.trim())
          .map((r) => ({ name: r.name, text: r.note })),
      };
    });
  const notes = diary.notes.filter((n) => n.date === date);
  return {
    date,
    lessons,
    classNotes: notes.filter((n) => n.slot === null && n.text.trim()),
    studentNotes: notes.filter((n) => n.slot !== null),
    events: eventsOn(c, date),
  };
}
