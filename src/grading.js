import { integer, textField, uid, validDay } from "./utils.js";

/**
 * Period grades. Lessons store what happened (attendance, behaviour,
 * participation, material) and assessments store raw 0–100 scores; the grade
 * is always recalculated from them with the teacher's editable rules, so the
 * rules can change at the end of a period without losing any record.
 */

export const LESSON_MARKS = {
  status: {
    present: "Presente",
    late: "Atraso",
    absent: "Falta",
    excused: "Falta justificada",
  },
  behavior: { good: "Bom", regular: "Regular", poor: "A melhorar" },
  participation: { normal: "Normal", active: "Ativa", low: "Fraca" },
  material: { yes: "Tem material", no: "Sem material" },
};

export const COMPONENTS = {
  cognitive: "Cognitivo (trabalhos)",
  behavior: "Comportamento",
  participation: "Participação",
  attendance: "Assiduidade, pontualidade e material",
};

/** School year periods starting in September of the current school year. */
export function defaultPeriods(today = new Date()) {
  const y =
    today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return [
    { id: "p1", name: "1.º Período", start: `${y}-09-01`, end: `${y}-12-31` },
    {
      id: "p2",
      name: "2.º Período",
      start: `${y + 1}-01-01`,
      end: `${y + 1}-03-31`,
    },
    {
      id: "p3",
      name: "3.º Período",
      start: `${y + 1}-04-01`,
      end: `${y + 1}-08-31`,
    },
  ];
}

/** Defaults: the weights of the teacher's spreadsheet plus suggested values. */
export function defaultGrading(today) {
  return {
    weights: { cognitive: 80, behavior: 10, participation: 5, attendance: 5 },
    values: {
      behavior: { good: 100, regular: 60, poor: 20 },
      // A normal lesson keeps the maximum; "Ativa" is a positive mark only.
      participation: { active: 100, normal: 100, low: 50 },
      // Deducted from 100 in a lesson; an unjustified absence scores 0.
      late: 50,
      noMaterial: 50,
    },
    periods: defaultPeriods(today),
  };
}

/** Default assessments of a period (weights inside the cognitive part). */
export function defaultAssessments(periodId) {
  return [
    ["1.º Trabalho", 50],
    ["2.º Trabalho", 40],
    ["Extra", 10],
  ].map(([name, weight]) => ({
    id: uid(),
    periodId,
    name,
    weight,
    date: "",
    description: "",
    criteria: [],
    scores: {},
    marks: {},
  }));
}

/**
 * A trabalho's score for one student (0–100), or undefined if not yet
 * evaluated. Without criteria it is the score typed by the teacher; with
 * criteria it is Σ(criterion mark × weight) ÷ 100, once every criterion has
 * a mark and the weights add up to 100.
 */
export function assessmentScore(a, studentId) {
  if (!a.criteria.length) return a.scores[studentId];
  if (criteriaTotal(a) !== 100) return undefined;
  const marks = a.marks[studentId];
  if (!marks || a.criteria.some((k) => marks[k.id] === undefined))
    return undefined;
  return a.criteria.reduce((n, k) => n + marks[k.id] * k.weight, 0) / 100;
}
export const criteriaTotal = (a) =>
  a.criteria.reduce((n, k) => n + k.weight, 0);

const score = (x) => integer(x, 0, 100);

export function validateGrading(raw) {
  if (raw === undefined) return defaultGrading();
  const fail = () => {
    throw Error("Regras de avaliação inválidas.");
  };
  if (!raw || !raw.weights || !raw.values || !Array.isArray(raw.periods))
    fail();
  const weights = {};
  for (const k of Object.keys(COMPONENTS)) {
    if (!score(raw.weights[k])) fail();
    weights[k] = raw.weights[k];
  }
  if (Object.values(weights).reduce((a, b) => a + b, 0) !== 100) fail();
  const v = raw.values,
    values = { behavior: {}, participation: {} };
  for (const group of ["behavior", "participation"])
    for (const k of Object.keys(LESSON_MARKS[group])) {
      if (!v[group] || !score(v[group][k])) fail();
      values[group][k] = v[group][k];
    }
  // The normal mark is the starting point: every lesson without a problem
  // keeps the student at the top. Rules saved before this was fixed had 70.
  values.behavior.good = 100;
  values.participation.normal = 100;
  if (!score(v.late) || !score(v.noMaterial)) fail();
  values.late = v.late;
  values.noMaterial = v.noMaterial;
  if (!raw.periods.length || raw.periods.length > 6) fail();
  const ids = new Set();
  const periods = raw.periods.map((p) => {
    if (
      !p ||
      !textField(p.id, 40) ||
      !p.id ||
      ids.has(p.id) ||
      !textField(p.name, 40) ||
      !p.name.trim() ||
      !validDay(p.start) ||
      !validDay(p.end) ||
      p.start > p.end
    )
      fail();
    ids.add(p.id);
    return { id: p.id, name: p.name, start: p.start, end: p.end };
  });
  return { weights, values, periods };
}

export function validateAssessments(raw, periodIds) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 200)
    throw Error("Avaliações inválidas.");
  const ids = new Set();
  return raw.map((a) => {
    if (
      !a ||
      !textField(a.id, 100) ||
      !a.id ||
      ids.has(a.id) ||
      !textField(a.periodId, 40) ||
      !textField(a.name, 60) ||
      !integer(a.weight, 0, 100) ||
      !a.scores ||
      typeof a.scores !== "object" ||
      Array.isArray(a.scores)
    )
      throw Error("Avaliação inválida.");
    ids.add(a.id);
    const scores = {};
    for (const [studentId, value] of Object.entries(a.scores)) {
      if (studentId.length > 100 || !(value === null || score(value)))
        throw Error("Nota de avaliação inválida.");
      if (value !== null) scores[studentId] = value;
    }
    // Version 13: date, description and criteria (weights adding up to 100)
    // with a mark per student and criterion.
    const date = a.date ?? "",
      description = a.description ?? "",
      rawCriteria = a.criteria ?? [],
      rawMarks = a.marks ?? {};
    if (
      (date !== "" && !validDay(date)) ||
      !textField(description, 1000) ||
      !Array.isArray(rawCriteria) ||
      rawCriteria.length > 12 ||
      !rawMarks ||
      typeof rawMarks !== "object" ||
      Array.isArray(rawMarks)
    )
      throw Error("Avaliação inválida.");
    const criterionIds = new Set();
    const criteria = rawCriteria.map((k) => {
      if (
        !k ||
        !textField(k.id, 100) ||
        !k.id ||
        criterionIds.has(k.id) ||
        !textField(k.name, 80) ||
        !integer(k.weight, 0, 100)
      )
        throw Error("Critério de avaliação inválido.");
      criterionIds.add(k.id);
      return { id: k.id, name: k.name, weight: k.weight };
    });
    const marks = {};
    for (const [studentId, row] of Object.entries(rawMarks)) {
      if (studentId.length > 100 || !row || typeof row !== "object")
        throw Error("Nota de critério inválida.");
      const clean = {};
      for (const [id, value] of Object.entries(row)) {
        if (!criterionIds.has(id) || !(value === null || score(value)))
          throw Error("Nota de critério inválida.");
        if (value !== null) clean[id] = value;
      }
      if (Object.keys(clean).length) marks[studentId] = clean;
    }
    return {
      id: a.id,
      periodId: a.periodId,
      name: a.name,
      weight: a.weight,
      date,
      description,
      criteria,
      // With criteria the score comes from the marks: kept in one place only.
      scores: criteria.length ? {} : scores,
      marks: criteria.length ? marks : {},
    };
  });
}

export function periodFor(grading, date) {
  return grading.periods.find((p) => p.start <= date && date <= p.end) || null;
}

const average = (list) =>
  list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;

/** Weighted average of the parts that exist; null when none exists. */
function weighted(parts) {
  const present = parts.filter(
    ([value, weight]) => value !== null && weight > 0,
  );
  const total = present.reduce((n, [, w]) => n + w, 0);
  return total ? present.reduce((n, [v, w]) => n + v * w, 0) / total : null;
}

// Lesson-based parts start at the top: with no lesson recorded yet (or no
// problem recorded), a student has 100. Each lesson with a problem lowers the
// average and later good lessons slowly bring it back up.
const START = 100;

/**
 * One student's grade in a period. "unmarked" counts as present: in class the
 * teacher only taps exceptions. Justified absences are left out.
 * `before` (YYYY-MM-DD) counts only earlier lessons, to show the trend.
 */
export function studentGrade(c, grading, periodId, student, before = null) {
  const period = grading.periods.find((p) => p.id === periodId),
    v = grading.values,
    behavior = [],
    participation = [],
    attendance = [],
    counts = { lessons: 0, absent: 0, excused: 0, late: 0, noMaterial: 0 };
  let lastDate = null;
  if (period)
    for (const lesson of c.diary.lessons) {
      if (lesson.date < period.start || lesson.date > period.end) continue;
      if (before && lesson.date >= before) continue;
      const row = lesson.attendance.find((r) => r.studentId === student.id);
      if (!row) continue;
      counts.lessons++;
      if (!lastDate || lesson.date > lastDate) lastDate = lesson.date;
      if (row.status === "excused") {
        counts.excused++;
        continue;
      }
      if (row.status === "absent") {
        counts.absent++;
        attendance.push(0);
        continue;
      }
      const late = row.status === "late",
        noMaterial = row.material === false;
      if (late) counts.late++;
      if (noMaterial) counts.noMaterial++;
      attendance.push(
        Math.max(
          0,
          100 - (late ? v.late : 0) - (noMaterial ? v.noMaterial : 0),
        ),
      );
      behavior.push(v.behavior[row.behavior || "good"]);
      participation.push(v.participation[row.participation || "normal"]);
    }
  const assessments = c.assessments.filter(
      (a) => a.periodId === periodId && a.weight > 0,
    ),
    scoreOf = (a) => assessmentScore(a, student.id),
    graded = assessments.filter((a) => scoreOf(a) !== undefined);
  const parts = {
    cognitive: weighted(graded.map((a) => [scoreOf(a), a.weight])),
    behavior: average(behavior) ?? START,
    participation: average(participation) ?? START,
    attendance: average(attendance) ?? START,
  };
  // No assessment scored yet: there is no real grade to show (the best
  // possible grade below still is), instead of a misleading 5,00.
  const final =
    parts.cognitive === null && grading.weights.cognitive > 0
      ? null
      : weighted(
          Object.keys(COMPONENTS).map((k) => [parts[k], grading.weights[k]]),
        );
  // Highest grade still possible: 100 in every assessment not yet scored.
  const bestCognitive =
    weighted(assessments.map((a) => [scoreOf(a) ?? 100, a.weight])) ?? 100;
  const best = weighted(
    Object.keys(COMPONENTS).map((k) => [
      k === "cognitive" ? bestCognitive : parts[k],
      grading.weights[k],
    ]),
  );
  return {
    ...parts,
    final,
    final5: final === null ? null : final / 20,
    best,
    best5: best / 20,
    counts,
    lastDate,
    missingScores: assessments
      .filter((a) => scoreOf(a) === undefined)
      .map((a) => a.name),
  };
}

/**
 * Follow-up table: each student's grade now and the change caused by the
 * most recent lesson (compared with the grade before that lesson).
 */
export function classProgress(c, grading, periodId) {
  return classGrades(c, grading, periodId).map((g) => {
    const student = c.students[g.number - 1],
      before = g.lastDate
        ? studentGrade(c, grading, periodId, student, g.lastDate)
        : null,
      change = {};
    for (const k of ["behavior", "participation", "attendance", "best"])
      change[k] = before ? g[k] - before[k] : 0;
    return { ...g, change };
  });
}

/** Grades of every named student, in class-list order (slot order). */
export function classGrades(c, grading, periodId) {
  return c.students
    .map((s, slot) => ({ slot, student: s }))
    .filter(({ student }) => student.name)
    .map(({ slot, student }) => ({
      number: slot + 1,
      name: student.name,
      id: student.id,
      ...studentGrade(c, grading, periodId, student),
    }));
}

const decimal = (x, digits) =>
  x === null ? "" : x.toFixed(digits).replace(".", ",");

/** Spreadsheet export (semicolons and decimal commas open in Portuguese Excel). */
export function gradesCsv(c, grading, periodId) {
  const period = grading.periods.find((p) => p.id === periodId);
  const header = [
    "N.º",
    "Nome",
    ...Object.values(COMPONENTS),
    "Final (0-100)",
    "Final (0-5)",
    "Aulas",
    "Faltas",
    "Faltas justificadas",
    "Atrasos",
    "Sem material",
  ];
  const quote = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const rows = classGrades(c, grading, periodId).map((g) => [
    g.number,
    quote(g.name),
    ...Object.keys(COMPONENTS).map((k) => decimal(g[k], 1)),
    decimal(g.final, 1),
    decimal(g.final5, 2),
    g.counts.lessons,
    g.counts.absent,
    g.counts.excused,
    g.counts.late,
    g.counts.noMaterial,
  ]);
  return (
    "﻿" +
    [
      [quote(c.className + " · " + (period ? period.name : ""))],
      header.map(quote),
      ...rows,
    ]
      .map((r) => r.join(";"))
      .join("\r\n")
  );
}

const fmt = (x) =>
  Number.isInteger(x)
    ? String(x)
    : x
        .toFixed(2)
        .replace(/\.?0+$/, "")
        .replace(".", ",");

/** "3 × Bom (100) + 1 × Regular (60) = 400 ÷ 4 = 90" from value counts. */
function averageLine(entries) {
  const used = entries.filter(([, , n]) => n > 0),
    count = used.reduce((a, [, , n]) => a + n, 0);
  if (!count)
    return { formula: "Sem aulas registadas: começa em 100.", result: START };
  const sum = used.reduce((a, [, value, n]) => a + value * n, 0);
  return {
    formula:
      used
        .map(([label, value, n]) => n + " × " + label + " (" + value + ")")
        .join(" + ") +
      " = " +
      fmt(sum) +
      " ÷ " +
      count +
      " aulas",
    result: sum / count,
  };
}

/**
 * Step-by-step calculation of a student's period grade, with the numbers
 * used, so the teacher can check it by hand.
 */
export function explainGrade(c, grading, periodId, student) {
  const g = studentGrade(c, grading, periodId, student),
    v = grading.values,
    w = grading.weights,
    period = grading.periods.find((p) => p.id === periodId),
    rows = period
      ? c.diary.lessons
          .filter((l) => l.date >= period.start && l.date <= period.end)
          .map((l) => l.attendance.find((r) => r.studentId === student.id))
          .filter(Boolean)
      : [],
    present = rows.filter((r) => !["absent", "excused"].includes(r.status)),
    countOf = (test) => rows.filter(test).length;
  const behavior = averageLine(
    Object.entries(LESSON_MARKS.behavior).map(([k, label]) => [
      label,
      v.behavior[k],
      present.filter((r) => (r.behavior || "good") === k).length,
    ]),
  );
  const participation = averageLine(
    Object.entries(LESSON_MARKS.participation).map(([k, label]) => [
      label,
      v.participation[k],
      present.filter((r) => (r.participation || "normal") === k).length,
    ]),
  );
  const late = (r) => r.status === "late",
    noMat = (r) => r.material === false,
    inClass = (r) => !["absent", "excused"].includes(r.status);
  const attendance = averageLine([
    [
      "sem ocorrências",
      100,
      countOf((r) => inClass(r) && !late(r) && !noMat(r)),
    ],
    ["atraso", Math.max(0, 100 - v.late), countOf((r) => late(r) && !noMat(r))],
    [
      "sem material",
      Math.max(0, 100 - v.noMaterial),
      countOf((r) => inClass(r) && !late(r) && noMat(r)),
    ],
    [
      "atraso e sem material",
      Math.max(0, 100 - v.late - v.noMaterial),
      countOf((r) => late(r) && noMat(r)),
    ],
    ["falta", 0, countOf((r) => r.status === "absent")],
  ]);
  if (g.counts.excused)
    attendance.formula +=
      " (" + g.counts.excused + " falta(s) justificada(s) não contam)";
  const assessments = c.assessments.filter(
      (a) => a.periodId === periodId && a.weight > 0,
    ),
    scoreOf = (a) => assessmentScore(a, student.id),
    graded = assessments.filter((a) => scoreOf(a) !== undefined),
    totalWeight = graded.reduce((n, a) => n + a.weight, 0);
  const cognitive = {
    formula: graded.length
      ? "(" +
        graded
          .map(
            (a) =>
              a.name +
              " " +
              String(Math.round(scoreOf(a) * 100) / 100).replace(".", ",") +
              " × " +
              a.weight,
          )
          .join(" + ") +
        ") ÷ " +
        totalWeight +
        (g.missingScores.length
          ? " · ainda sem nota: " + g.missingScores.join(", ")
          : "")
      : "Ainda sem notas de trabalhos: fica de fora da nota final.",
    result: g.cognitive,
  };
  const parts = [
    ["cognitive", COMPONENTS.cognitive, cognitive],
    ["behavior", COMPONENTS.behavior, behavior],
    ["participation", COMPONENTS.participation, participation],
    ["attendance", COMPONENTS.attendance, attendance],
  ];
  const used = parts.filter(([k, , p]) => p.result !== null && w[k] > 0),
    weightSum = used.reduce((n, [k]) => n + w[k], 0);
  const final = {
    formula:
      g.final === null
        ? "Ainda sem notas de trabalhos: a nota final aparece com a primeira nota."
        : "(" +
          used
            .map(
              ([k, , p]) =>
                fmt(Math.round(p.result * 100) / 100) + " × " + w[k],
            )
            .join(" + ") +
          ") ÷ " +
          weightSum +
          (g.final === null
            ? ""
            : " = " +
              fmt(Math.round(g.final * 100) / 100) +
              " → ÷ 20 = " +
              g.final5.toFixed(2).replace(".", ",") +
              " (escala 0–5)"),
    result: g.final,
  };
  return {
    lessons: rows.length,
    parts: parts.map(([k, label, p]) => ({
      key: k,
      label,
      weight: w[k],
      ...p,
    })),
    final,
    grade: g,
  };
}
