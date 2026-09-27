import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoWorkspace,
  criterionMarks,
  DEMO_STUDENTS,
} from "../tools/demo-data.js";
import { assessmentScore, explainGrade, studentGrade } from "../src/grading.js";

const w = buildDemoWorkspace(),
  c = w.classes[0],
  rules = w.grading,
  student = (name) => c.students.find((s) => s.name === name),
  grade = (name) => studentGrade(c, rules, "p1", student(name));

/**
 * Independent calculation, written straight from the rules (not from
 * grading.js): per lesson, then averages, then the weighted final grade.
 */
function reference(s) {
  const behavior = [],
    participation = [],
    attendance = [];
  for (const lesson of c.diary.lessons) {
    const r = lesson.attendance.find((x) => x.studentId === s.id);
    if (!r || r.status === "excused") continue;
    if (r.status === "absent") {
      attendance.push(0);
      continue;
    }
    let a = 100;
    if (r.status === "late") a -= 50;
    if (r.material === false) a -= 50;
    attendance.push(Math.max(0, a));
    behavior.push({ good: 100, regular: 60, poor: 20 }[r.behavior]);
    participation.push({ normal: 100, active: 100, low: 50 }[r.participation]);
  }
  const avg = (xs) =>
    xs.length ? xs.reduce((a, b) => a + b) / xs.length : 100;
  let sum = 0,
    weights = 0;
  for (const a of c.assessments) {
    // By criteria: Σ(mark × criterion weight) ÷ 100; otherwise the score typed.
    const value = a.criteria.length
      ? a.marks[s.id] &&
        a.criteria.reduce((n, k) => n + a.marks[s.id][k.id] * k.weight, 0) / 100
      : a.scores[s.id];
    if (value !== undefined) {
      sum += value * a.weight;
      weights += a.weight;
    }
  }
  const cognitive = weights ? sum / weights : null;
  const parts = {
    cognitive,
    behavior: avg(behavior),
    participation: avg(participation),
    attendance: avg(attendance),
  };
  parts.final =
    cognitive === null
      ? null
      : cognitive * 0.8 +
        parts.behavior * 0.1 +
        parts.participation * 0.05 +
        parts.attendance * 0.05;
  return parts;
}

test("demo class 5ºX: 30 students, 10 lessons, trabalhos and TPC", () => {
  assert.equal(c.className, "5ºX");
  assert.equal(c.students.filter((s) => s.name).length, 30);
  assert.equal(c.diary.lessons.length, 10);
  assert.equal(c.assessments.length, 3);
  // Every lesson row starts at the best scenario unless the teacher changed it.
  const sara = student("Sara Oliveira");
  for (const lesson of c.diary.lessons) {
    const r = lesson.attendance.find((x) => x.studentId === sara.id);
    assert.deepEqual(
      [r.status, r.behavior, r.participation, r.material],
      ["unmarked", "good", "normal", true],
    );
  }
});

test("every student's grade matches an independent calculation", () => {
  for (const s of c.students.filter((x) => x.name)) {
    const got = studentGrade(c, rules, "p1", s),
      want = reference(s);
    for (const k of [
      "cognitive",
      "behavior",
      "participation",
      "attendance",
      "final",
    ]) {
      if (want[k] === null) assert.equal(got[k], null, s.name + " " + k);
      else assert.ok(Math.abs(got[k] - want[k]) < 1e-9, s.name + " " + k);
    }
  }
});

test("hand-checked scenarios", () => {
  // Nothing marked, 100 in every trabalho: 100 → 5,00.
  assert.equal(grade("Ana Beatriz Costa").final5, 5);
  // Spreadsheet row: trabalhos 50/40/90 → 50 × 0,8 + 20 = 60 → 3,00.
  assert.equal(grade("Bruno Ferreira").final, 60);
  // 3 absences in 10 lessons: (7 × 100 + 3 × 0) ÷ 10 = 70.
  const carla = grade("Carla Mendes");
  assert.equal(carla.attendance, 70);
  // 1.º Trabalho by criteria: (100 × 20 + 100 × 20 + 100 × 20 + 30 × 40) ÷ 100 = 72.
  const first = c.assessments[0];
  assert.deepEqual(
    first.criteria.map((k) => first.marks[student("Carla Mendes").id][k.id]),
    [100, 100, 100, 30],
  );
  assert.equal(assessmentScore(first, student("Carla Mendes").id), 72);
  // (72 × 50 + 68 × 40 + 80 × 10) ÷ 100 = 71,2 → 71,2 × 0,8 + 10 + 5 + 3,5 = 75,46.
  assert.ok(Math.abs(carla.final - 75.46) < 1e-9);
  assert.equal(carla.final5.toFixed(2), "3.77");
  // Justified absences do not count.
  assert.equal(grade("Diogo Pires").attendance, 100);
  assert.equal(grade("Diogo Pires").counts.excused, 2);
  // 2 late: (8 × 100 + 2 × 50) ÷ 10 = 90.
  assert.equal(grade("Eva Santos").attendance, 90);
  // 3 without material: (7 × 100 + 3 × 50) ÷ 10 = 85.
  assert.equal(grade("Filipe Rocha").attendance, 85);
  // Late and without material the same day: that lesson is 0 → 90.
  assert.equal(grade("Gabriela Lima").attendance, 90);
  // Behaviour: 2 × Regular → (8 × 100 + 2 × 60) ÷ 10 = 92; 1 × A melhorar → 92.
  assert.equal(grade("Hugo Martins").behavior, 92);
  assert.equal(grade("Inês Carvalho").behavior, 92);
  // "Ativa" never goes above 100; 4 × Fraca → (6 × 100 + 4 × 50) ÷ 10 = 80.
  assert.equal(grade("João Almeida").participation, 100);
  assert.equal(grade("Laura Sousa").participation, 80);
  // Missing 2.º Trabalho: (80 × 50 + 70 × 10) ÷ 60, marked as provisional.
  const miguel = grade("Miguel Ribeiro");
  assert.ok(Math.abs(miguel.cognitive - 4700 / 60) < 1e-9);
  assert.deepEqual(miguel.missingScores, ["2.º Trabalho"]);
  // No trabalho scored: no final grade yet, but 5,00 still possible.
  const nadia = grade("Nádia Gomes");
  assert.equal(nadia.final, null);
  assert.equal(nadia.best5, 5);
  // Joined at lesson 5: only 6 lessons count.
  assert.equal(grade("Gonçalo Cunha").counts.lessons, 6);
});

test("TPC deliveries and points are linked to the right homework", () => {
  const [ficha1, ficha2] = [c.diary.lessons[1], c.diary.lessons[5]];
  assert.equal(ficha2.due, "2026-09-22");
  assert.equal(ficha1.due, "2026-09-16");
  const oscar = student("Óscar Teixeira");
  assert.equal(
    ficha1.attendance.find((r) => r.studentId === oscar.id).delivery,
    "missing",
  );
  // Ana: +2 in lesson 3, +1 for each Ficha delivered.
  assert.equal(student("Ana Beatriz Costa").points, 4);
  assert.equal(DEMO_STUDENTS.length, 30);
});

test("the explanation shows the numbers used, so it can be checked by hand", () => {
  const e = explainGrade(c, rules, "p1", student("Carla Mendes"));
  const part = (k) => e.parts.find((p) => p.key === k);
  assert.match(
    part("attendance").formula,
    /7 × sem ocorrências \(100\) \+ 3 × falta \(0\) = 700 ÷ 10 aulas/,
  );
  assert.match(
    part("cognitive").formula,
    /1\.º Trabalho 72 × 50 \+ 2\.º Trabalho 68 × 40 \+ Extra 80 × 10\) ÷ 100/,
  );
  assert.match(e.final.formula, /= 75,46 → ÷ 20 = 3,77/);
  const nadia = explainGrade(c, rules, "p1", student("Nádia Gomes"));
  assert.match(nadia.final.formula, /Ainda sem notas de trabalhos/);
});

test("criterion marks give exactly each trabalho score", () => {
  for (let score = 0; score <= 100; score++) {
    const m = criterionMarks(score);
    assert.ok(m.every((x) => Number.isInteger(x) && x >= 0 && x <= 100));
    assert.equal((m[0] * 20 + m[1] * 20 + m[2] * 20 + m[3] * 40) / 100, score);
  }
  const first = c.assessments[0];
  assert.equal(
    first.criteria.reduce((n, k) => n + k.weight, 0),
    100,
  );
  assert.deepEqual(first.scores, {});
});
