import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentScore,
  classGrades,
  criteriaTotal,
  defaultAssessments,
  defaultGrading,
  explainGrade,
  gradesCsv,
  studentGrade,
  validateGrading,
} from "../src/grading.js";
import { createLesson } from "../src/diary-data.js";
import { emptyWorkspace, validateWorkspace } from "../src/model.js";
import { emptyStudent, setStudentName } from "../src/students.js";

const TODAY = new Date("2026-10-15T12:00:00");

function classWith(names) {
  const students = Array.from({ length: 30 }, () => emptyStudent());
  names.forEach((n, i) => setStudentName(students[i], n));
  return {
    version: 6,
    id: "c1",
    className: "7.º B",
    lives: 5,
    students,
    groups: [],
    history: [],
    archived: false,
    diary: { lessons: [], notes: [] },
    assessments: [],
  };
}
function lesson(c, date, marks = {}) {
  const l = createLesson(c, c.diary, date, "Prof.");
  l.attendance.forEach((r) => Object.assign(r, marks[r.name] || {}));
  c.diary.lessons.push(l);
  return l;
}

test("the spreadsheet example gives the same grade (57,3 · 2,86)", () => {
  // Example row: trabalhos 50/40/90, comportamento 80, participação 95, assiduidade 90.
  const g = defaultGrading(TODAY);
  g.values.behavior.good = 80;
  g.values.participation.normal = 95;
  g.values.late = 10;
  const c = classWith(["Ana"]),
    ana = c.students[0];
  c.assessments = defaultAssessments("p1");
  [50, 40, 90].forEach((v, i) => (c.assessments[i].scores[ana.id] = v));
  lesson(c, "2026-10-01", { Ana: { status: "late" } });
  const r = studentGrade(c, g, "p1", ana);
  assert.equal(r.cognitive, 50);
  assert.equal(r.behavior, 80);
  assert.equal(r.participation, 95);
  assert.equal(r.attendance, 90);
  assert.equal(r.final.toFixed(1), "57.3");
  assert.equal(r.final5.toFixed(2), "2.86");
  assert.deepEqual(r.missingScores, []);
});

test("absences, justified absences, lateness and missing material", () => {
  const g = defaultGrading(TODAY),
    c = classWith(["Ana"]),
    ana = c.students[0];
  lesson(c, "2026-10-01", { Ana: { behavior: "poor" } }); // present
  lesson(c, "2026-10-02", { Ana: { status: "late", material: false } }); // 100-50-50
  lesson(c, "2026-10-03", { Ana: { status: "absent" } }); // 0, no behaviour
  lesson(c, "2026-10-04", { Ana: { status: "excused" } }); // ignored
  lesson(c, "2027-02-01", { Ana: { status: "absent" } }); // other period
  const r = studentGrade(c, g, "p1", ana);
  assert.deepEqual(r.counts, {
    lessons: 4,
    absent: 1,
    excused: 1,
    late: 1,
    noMaterial: 1,
  });
  assert.equal(r.attendance, (100 + 0 + 0) / 3);
  assert.equal(r.behavior, (20 + 100) / 2);
  assert.equal(r.participation, 100);
  // No assessment yet: no final grade (only the best possible one).
  assert.equal(r.cognitive, null);
  assert.equal(r.final, null);
  assert.ok(r.best5 < 5);
});

test("unscored assessments are left out and listed", () => {
  const g = defaultGrading(TODAY),
    c = classWith(["Ana", "Bruno"]),
    [ana, bruno] = c.students;
  c.assessments = defaultAssessments("p1");
  c.assessments[0].scores[ana.id] = 80; // only the 1st trabalho
  const r = studentGrade(c, g, "p1", ana);
  assert.equal(r.cognitive, 80);
  assert.deepEqual(r.missingScores, ["2.º Trabalho", "Extra"]);
  assert.equal(studentGrade(c, g, "p1", bruno).cognitive, null);
  assert.deepEqual(
    classGrades(c, g, "p1").map((x) => [x.number, x.name]),
    [
      [1, "Ana"],
      [2, "Bruno"],
    ],
  );
});

test("rules must be complete and weights must add up to 100", () => {
  const g = defaultGrading(TODAY);
  assert.deepEqual(validateGrading(g), g);
  assert.throws(() =>
    validateGrading({ ...g, weights: { ...g.weights, cognitive: 70 } }),
  );
  assert.throws(() =>
    validateGrading({
      ...g,
      periods: [{ ...g.periods[0], end: "2026-01-01" }],
    }),
  );
  assert.equal(g.periods[0].start, "2026-09-01");
  assert.equal(g.periods[2].end, "2027-08-31");
});

test("version 11 data gets default marks and rules; version 12 round trips", () => {
  const w = { ...emptyWorkspace(), version: 11 };
  delete w.grading;
  const c = classWith(["Ana"]);
  delete c.assessments;
  const l = createLesson(c, c.diary, "2026-10-01", "Prof.");
  l.attendance.forEach((r) => {
    delete r.behavior;
    delete r.participation;
    delete r.material;
  });
  c.diary.lessons.push(l);
  w.classes = [c];
  const v = validateWorkspace(w);
  const row = v.classes[0].diary.lessons[0].attendance[0];
  assert.deepEqual(
    [row.behavior, row.participation, row.material],
    ["good", "normal", true],
  );
  assert.deepEqual(v.classes[0].assessments, []);
  assert.deepEqual(v.grading.weights, defaultGrading().weights);
  v.classes[0].assessments = defaultAssessments(v.grading.periods[0].id);
  v.classes[0].assessments[0].scores[c.students[0].id] = 77;
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(v))), v);
});

test("spreadsheet export uses semicolons and decimal commas", () => {
  const g = defaultGrading(TODAY),
    c = classWith(['Ana "Bia"']);
  c.assessments = defaultAssessments("p1");
  c.assessments.forEach((a) => (a.scores[c.students[0].id] = 55));
  const csv = gradesCsv(c, g, "p1").replace("﻿", "").split("\r\n");
  assert.equal(csv[0], '"7.º B · 1.º Período"');
  assert.match(csv[1], /^"N\.º";"Nome";/);
  assert.match(csv[2], /^1;"Ana ""Bia""";55,0;/);
});

test("everyone starts at the top; the best possible grade only falls with real results", () => {
  const g = defaultGrading(TODAY),
    c = classWith(["Ana"]),
    ana = c.students[0];
  let r = studentGrade(c, g, "p1", ana);
  assert.deepEqual(
    [r.behavior, r.participation, r.attendance, r.cognitive, r.best5],
    [100, 100, 100, null, 5],
  );
  c.assessments = defaultAssessments("p1");
  c.assessments[0].scores[ana.id] = 50; // 1.º Trabalho (50%) only
  r = studentGrade(c, g, "p1", ana);
  // Trabalhos at best: 50×0,5 + 100×0,4 + 100×0,1 = 75 → 75×0,8 + 20 = 80.
  assert.equal(r.best, 80);
  assert.equal(r.best5, 4);
  assert.equal(r.cognitive, 50);
});

test("a trabalho with criteria: score = Σ(mark × weight) ÷ 100", () => {
  const g = defaultGrading(TODAY),
    c = classWith(["Ana", "Bia"]),
    [ana, bia] = c.students;
  c.assessments = defaultAssessments("p1");
  const a = c.assessments[0];
  a.criteria = [
    { id: "k1", name: "Criou a pasta", weight: 20 },
    { id: "k2", name: "Criou o ficheiro", weight: 20 },
    { id: "k3", name: "Guardou na pasta", weight: 20 },
    { id: "k4", name: "Escreveu o texto", weight: 40 },
  ];
  a.marks[ana.id] = { k1: 100, k2: 100, k3: 50, k4: 75 };
  a.marks[bia.id] = { k1: 100, k2: 100 }; // not finished yet
  assert.equal(criteriaTotal(a), 100);
  // (100 × 20 + 100 × 20 + 50 × 20 + 75 × 40) ÷ 100 = 80.
  assert.equal(assessmentScore(a, ana.id), 80);
  assert.equal(assessmentScore(a, bia.id), undefined);
  assert.equal(studentGrade(c, g, "p1", ana).cognitive, 80);
  assert.deepEqual(studentGrade(c, g, "p1", bia).missingScores, [
    "1.º Trabalho",
    "2.º Trabalho",
    "Extra",
  ]);
  assert.match(
    explainGrade(c, g, "p1", ana).parts[0].formula,
    /1\.º Trabalho 80 × 50/,
  );
  // Weights not adding up to 100: no score until they do.
  a.criteria[3].weight = 30;
  assert.equal(assessmentScore(a, ana.id), undefined);
  a.criteria[3].weight = 40;
  // Round trip; with criteria the typed scores are dropped (one place only).
  a.scores[ana.id] = 12;
  a.date = "2026-10-05";
  a.description = "Bloco de Notas";
  const w = { ...emptyWorkspace(), grading: g, classes: [c] };
  const back = validateWorkspace(JSON.parse(JSON.stringify(w))).classes[0]
    .assessments[0];
  assert.deepEqual(back.scores, {});
  assert.deepEqual(back.marks[ana.id], a.marks[ana.id]);
  assert.equal(back.date, "2026-10-05");
  assert.equal(assessmentScore(back, ana.id), 80);
  // Invalid data is refused.
  a.criteria.push({ id: "k1", name: "Repetido", weight: 0 });
  assert.throws(() => validateWorkspace(JSON.parse(JSON.stringify(w))));
});
