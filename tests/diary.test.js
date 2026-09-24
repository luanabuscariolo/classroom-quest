import test from "node:test";
import assert from "node:assert/strict";
import {
  awardHomework,
  createLesson,
  dailyReport,
  dayDates,
  lessonReport,
  rewardableRows,
  wasRewarded,
} from "../src/diary-data.js";
import { emptyDiary, validClass } from "../src/model.js";
import { canUndo } from "../src/points.js";

function classWith(names) {
  const students = Array.from({ length: 30 }, (_, i) => ({
    name: names[i] || "",
    points: 0,
    inPool: !!names[i],
    gender: "robot",
    avatar: 16,
    avatarMode: "auto",
  }));
  return {
    version: 6,
    id: "c1",
    className: "7.º B",
    lives: 5,
    students,
    groups: [],
    history: [],
    archived: false,
    diary: emptyDiary(),
  };
}

test("a new lesson is numbered after the last one and lists named students", () => {
  const c = classWith(["Ana", "", "Bruno"]);
  c.diary.lessons.push({
    ...createLesson(c, c.diary, "2026-09-20", "X"),
    number: 7,
  });
  const l = createLesson(c, c.diary, "2026-09-21", "Prof. Teste");
  assert.equal(l.number, 8);
  assert.equal(l.teacher, "Prof. Teste");
  assert.deepEqual(
    l.attendance.map((r) => [r.slot, r.name, r.status, r.delivery]),
    [
      [0, "Ana", "unmarked", "pending"],
      [2, "Bruno", "unmarked", "pending"],
    ],
  );
});

test("homework points go once to delivered work and stay valid after a backup", () => {
  const c = classWith(["Ana", "Bruno", "Carla"]);
  const l = createLesson(c, c.diary, "2026-09-21", "Prof. Teste");
  l.homework = "Ficha 3";
  c.diary.lessons.push(l);
  l.attendance[0].delivery = "delivered";
  l.attendance[1].delivery = "missing";
  l.attendance[2].delivery = "delivered";
  // Carla's slot now belongs to someone else: her row is blocked.
  c.students[2].name = "Outra";

  const rows = rewardableRows(c, l);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Ana"],
  );
  const event = awardHomework(c, l, rows, 2);
  assert.equal(event.title, "TPC · 21/09/2026 · Ficha 3");
  assert.equal(c.students[0].points, 2);
  assert.equal(l.attendance[0].awardId, event.id);
  assert.equal(wasRewarded(c, l.attendance[0]), true);
  assert.deepEqual(rewardableRows(c, l), []);
  assert.doesNotThrow(() => validClass(c));

  // Undoing the event makes the delivery rewardable again.
  assert.equal(canUndo(c, event), true);
  event.undoneAt = new Date().toISOString();
  assert.deepEqual(
    rewardableRows(c, l).map((r) => r.name),
    ["Ana"],
  );
});

test("homework award refuses a score beyond safe integers", () => {
  const c = classWith(["Ana"]);
  const l = createLesson(c, c.diary, "2026-09-21", "X");
  l.attendance[0].delivery = "delivered";
  c.students[0].points = Number.MAX_SAFE_INTEGER;
  assert.equal(awardHomework(c, l, rewardableRows(c, l), 1), null);
  assert.equal(c.history.length, 0);
});

test("reports include lessons, notes and point events of the day", () => {
  const c = classWith(["Ana", "Bruno"]);
  const l = createLesson(c, c.diary, "2026-09-21", "Prof. Teste");
  l.summary = "Introdução";
  l.attendance[0].status = "present";
  l.attendance[1].status = "absent";
  l.attendance[1].note = "Consulta médica";
  c.diary.lessons.push(l);
  c.diary.notes.push(
    {
      id: "n1",
      date: "2026-09-21",
      text: "Turma agitada",
      slot: null,
      name: "",
    },
    { id: "n2", date: "2026-09-21", text: "Ajudou", slot: 0, name: "Ana" },
    { id: "n3", date: "2026-09-19", text: "Outro dia", slot: null, name: "" },
  );
  c.history.push({
    id: "h1",
    title: "Ajuste individual",
    date: "2026-09-21T10:00:00",
    points: 1,
    recipients: [{ slot: 0, name: "Ana" }],
    undoneAt: null,
  });

  const lessonText = lessonReport(c, c.diary, l, false);
  assert.match(lessonText, /Bruno · Falta · TPC: Por verificar/);
  assert.doesNotMatch(lessonText, /Consulta médica/);
  const privateText = lessonReport(c, c.diary, l, true);
  assert.match(privateText, /Observação privada: Consulta médica/);
  assert.match(privateText, /Turma: Turma agitada/);
  assert.doesNotMatch(privateText, /Outro dia/);

  const day = dailyReport(c, c.diary, "2026-09-21");
  assert.match(day, /AULA 1 · Prof\. Teste/);
  assert.match(day, /Bruno: Falta · Consulta médica/);
  assert.match(day, /NOTAS GERAIS\nTurma agitada/);
  assert.match(day, /NOTAS POR ALUNO\nAna: Ajudou/);
  assert.match(day, /Ajuste individual · \+1 · Ana/);

  assert.deepEqual(dayDates(c, c.diary), ["2026-09-21", "2026-09-19"]);
});
